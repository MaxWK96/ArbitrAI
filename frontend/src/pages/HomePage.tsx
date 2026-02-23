import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MetricsSection from "@/components/MetricsSection";
import HowItWorks from "@/components/HowItWorks";
import SystemArchitecture from "@/components/SystemArchitecture";
import DemoSection from "@/components/DemoSection";
import Footer from "@/components/Footer";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MetricsSection />
      <HowItWorks />
      <SystemArchitecture />
      <DemoSection />
      <Footer />
    </div>
  );
};

export default HomePage;
