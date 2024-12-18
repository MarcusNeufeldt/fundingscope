import { TradingVisualizer } from "@/components/TradingVisualizer";
import { SocialLinks } from "@/components/GitHubButton";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SocialLinks />
      <div className="flex-grow">
        <TradingVisualizer />
      </div>
    </div>
  );
};

export default Index;