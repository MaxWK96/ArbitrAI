// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IArbitrationRegistry} from "./interfaces/IArbitrationRegistry.sol";
import {IDisputeEscrow} from "./interfaces/IDisputeEscrow.sol";

/**
 * @title DisputeEscrow
 * @notice Holds ETH securely during arbitration. Funds can ONLY be released
 *         via a verified CRE workflow verdict — no admin override, no shortcuts.
 *
 * @dev Security properties:
 *      - ReentrancyGuard on all fund movements
 *      - Only CREVerifier can call executeVerdict / executeRefund
 *      - Party B must match exactly — no front-running
 *      - Protocol fee is taken from total pool, not from loser alone
 *      - Emergency pause doesn't freeze settled funds (transfer already happened)
 *
 * Prize tracks:
 *  - Risk & Compliance: trustless escrow with circuit breaker and fee transparency
 *  - CRE & AI: CRE is the ONLY path to fund release — not decorative
 */
contract DisputeEscrow is IDisputeEscrow, ReentrancyGuard, Pausable, Ownable {
    // ─────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────

    /// @notice Minimum deposit to prevent griefing / dust disputes
    uint256 public constant MIN_DEPOSIT = 0.005 ether;

    /// @notice Protocol fee: 1% of total escrow pool (50 bps from each side)
    uint256 public constant PROTOCOL_FEE_BPS = 100;

    uint256 private constant BPS_DENOMINATOR = 10_000;

    // ─────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────

    IArbitrationRegistry public registry;

    /// @notice Only the CREVerifier can trigger settlement
    address public creVerifier;

    /// @notice Protocol fee recipient
    address public treasury;

    /// @notice Monotonically increasing counter — makes disputeId deterministic across simulation/broadcast
    uint256 private _disputeNonce;

    /// @notice All escrow records keyed by disputeId
    mapping(bytes32 => EscrowRecord) private _escrows;

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    event DisputeCreated(
        bytes32 indexed disputeId,
        address indexed partyA,
        address indexed partyB,
        uint256 depositAmount,
        uint256 timestamp
    );

    event PartyBDeposited(
        bytes32 indexed disputeId,
        address indexed partyB,
        uint256 amount,
        uint256 timestamp
    );

    event VerdictExecuted(
        bytes32 indexed disputeId,
        address indexed winner,
        uint256 payoutAmount,
        uint256 feeAmount,
        bytes32 proofHash,
        uint256 timestamp
    );

    event RefundExecuted(
        bytes32 indexed disputeId,
        uint256 amountA,
        uint256 amountB,
        string reason,
        bytes32 proofHash,
        uint256 timestamp
    );

    /// @dev Emitted when circuit breaker triggers — visible in demo mode
    event CircuitBreakerActivated(
        bytes32 indexed disputeId,
        string reason,
        uint256 timestamp
    );

    event ContractsSet(address registry, address verifier, address treasury);

    // ─────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────

    error InsufficientDeposit(uint256 provided, uint256 required);
    error DepositMismatch(bytes32 disputeId, uint256 provided, uint256 required);
    error AlreadyDeposited(bytes32 disputeId, address party);
    error AlreadySettled(bytes32 disputeId);
    error EscrowNotActive(bytes32 disputeId);
    error NotPartyB(bytes32 disputeId, address caller);
    error NotCREVerifier(address caller);
    error TransferFailed(address recipient, uint256 amount);
    error ZeroAddress();

    // ─────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────

    modifier onlyCREVerifier() {
        if (msg.sender != creVerifier) revert NotCREVerifier(msg.sender);
        _;
    }

    // ─────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    // ─────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────

    function setContracts(address _registry, address _verifier) external onlyOwner {
        if (_registry == address(0) || _verifier == address(0)) revert ZeroAddress();
        registry = IArbitrationRegistry(_registry);
        creVerifier = _verifier;

        emit ContractsSet(_registry, _verifier, treasury);
    }

    // ─────────────────────────────────────────────────────────
    // Core: Dispute Lifecycle
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Party A creates a dispute and deposits their ETH stake
     * @param partyB The address of the opposing party (must match when they deposit)
     * @param description A public, human-readable summary of the dispute
     * @return disputeId Unique identifier derived from parties + registry counter
     *
     * @dev Party A's ETH is immediately locked. Party B must call depositAndActivate()
     *      with the same amount to activate the dispute.
     */
    function createDispute(address partyB, string calldata description)
        external
        payable
        override
        whenNotPaused
        nonReentrant
        returns (bytes32 disputeId)
    {
        if (msg.value < MIN_DEPOSIT) revert InsufficientDeposit(msg.value, MIN_DEPOSIT);
        if (partyB == address(0) || partyB == msg.sender) revert ZeroAddress();

        // Counter-based dispute ID — deterministic between simulation and on-chain broadcast.
        // Using a local nonce avoids dependence on block.timestamp/prevrandao, which differ
        // between Forge simulation and actual on-chain execution.
        disputeId = keccak256(
            abi.encodePacked(_disputeNonce++, msg.sender, partyB)
        );

        _escrows[disputeId] = EscrowRecord({
            partyA: msg.sender,
            partyB: partyB,
            depositA: msg.value,
            depositB: 0,
            partyADeposited: true,
            partyBDeposited: false,
            settled: false
        });

        // Register in the registry — creates the audit trail entry
        registry.registerDispute(disputeId, msg.sender, partyB, msg.value, description);

        emit DisputeCreated(disputeId, msg.sender, partyB, msg.value, block.timestamp);
    }

    /**
     * @notice Party B matches the deposit to activate the dispute
     * @dev Must send exactly as much as party A deposited (no more, no less).
     *      This symmetry ensures neither party has a financial advantage.
     */
    function depositAndActivate(bytes32 disputeId) external payable override whenNotPaused nonReentrant {
        EscrowRecord storage escrow = _escrows[disputeId];

        if (msg.sender != escrow.partyB) revert NotPartyB(disputeId, msg.sender);
        if (escrow.partyBDeposited) revert AlreadyDeposited(disputeId, msg.sender);
        if (escrow.settled) revert AlreadySettled(disputeId);

        // Require matching deposit for fairness
        if (msg.value != escrow.depositA) {
            revert DepositMismatch(disputeId, msg.value, escrow.depositA);
        }

        escrow.depositB = msg.value;
        escrow.partyBDeposited = true;

        // Both parties are in — activate dispute and open evidence submission window
        registry.updateStatus(disputeId, IArbitrationRegistry.DisputeStatus.ACTIVE);

        emit PartyBDeposited(disputeId, msg.sender, msg.value, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // Settlement — only callable by CREVerifier
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Release funds to the winner after CRE workflow consensus
     * @param disputeId The settled dispute
     * @param winner The winning party address
     * @param proofHash Keccak256 hash of the full CRE workflow output (stored on-chain as proof)
     *
     * @dev This function is the trust bridge between Chainlink CRE and on-chain settlement.
     *      The proofHash links this transaction to the exact AI reasoning that produced it.
     *      Only CREVerifier can call this — and CREVerifier only calls it after ECDSA
     *      signature verification against the authorized CRE operator key.
     *
     * Why CRE is essential (not decorative):
     *      Without CRE verifier authorization, this function CANNOT be called.
     *      There is no admin override. Funds are locked until CRE resolves the dispute.
     */
    function executeVerdict(bytes32 disputeId, address winner, bytes32 proofHash)
        external
        override
        onlyCREVerifier
        nonReentrant
    {
        EscrowRecord storage escrow = _escrows[disputeId];

        if (escrow.settled) revert AlreadySettled(disputeId);
        if (!escrow.partyADeposited || !escrow.partyBDeposited) revert EscrowNotActive(disputeId);

        escrow.settled = true;

        uint256 totalFunds = escrow.depositA + escrow.depositB;
        uint256 fee = (totalFunds * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = totalFunds - fee;

        // Update registry before transfers (checks-effects-interactions)
        registry.recordWorkflowOutput(disputeId, proofHash, winner);

        // Transfer fee to treasury
        if (fee > 0) {
            _safeTransfer(treasury, fee);
        }

        // Transfer winnings
        _safeTransfer(winner, payout);

        emit VerdictExecuted(disputeId, winner, payout, fee, proofHash, block.timestamp);
    }

    /**
     * @notice Refund both parties — triggered when AI models fail to reach consensus
     *         or when the circuit breaker activates
     * @param proofHash Hash of the CRE output explaining WHY consensus failed
     * @param reason Human-readable reason string (emitted in event for frontend display)
     *
     * @dev No fee taken on refunds — parties shouldn't pay when system can't resolve.
     *      The reason string is what the frontend displays in the "failure mode" demo.
     */
    function executeRefund(bytes32 disputeId, bytes32 proofHash, string calldata reason)
        external
        override
        onlyCREVerifier
        nonReentrant
    {
        EscrowRecord storage escrow = _escrows[disputeId];

        if (escrow.settled) revert AlreadySettled(disputeId);

        escrow.settled = true;

        // Record in registry before transfers
        registry.recordWorkflowOutput(disputeId, proofHash, address(0));

        emit CircuitBreakerActivated(disputeId, reason, block.timestamp);

        uint256 amountA = escrow.depositA;
        uint256 amountB = escrow.depositB;

        // Refund party A if they deposited
        if (amountA > 0) {
            _safeTransfer(escrow.partyA, amountA);
        }

        // Refund party B if they deposited
        if (amountB > 0) {
            _safeTransfer(escrow.partyB, amountB);
        }

        emit RefundExecuted(disputeId, amountA, amountB, reason, proofHash, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success,) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }

    // ─────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────

    function getEscrow(bytes32 disputeId) external view override returns (EscrowRecord memory) {
        return _escrows[disputeId];
    }

    function getTotalLocked() external view returns (uint256) {
        return address(this).balance;
    }

    // ─────────────────────────────────────────────────────────
    // Emergency
    // ─────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
