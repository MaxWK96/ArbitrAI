import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MetricsSection from "@/components/MetricsSection";
import HowItWorks from "@/components/HowItWorks";
import FlowDiagram from "@/components/FlowDiagram";
import ComparisonTable from "@/components/ComparisonTable";
import DeployedContracts from "@/components/DeployedContracts";
import DemoSection from "@/components/DemoSection";
import Footer from "@/components/Footer";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MetricsSection />
      <HowItWorks />
      <FlowDiagram />
      <ComparisonTable />
      <DeployedContracts />
      <DemoSection />
      <Footer />
    </div>
  );
};

export default HomePage;
