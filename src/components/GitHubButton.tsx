import { Button } from "@/components/ui/button";
import { Github, Twitter } from "lucide-react";

export const SocialLinks = () => {
  return (
    <div className="w-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b">
      <div className="container mx-auto py-2 px-4 flex items-center justify-center gap-4 flex-wrap">
        <span className="text-sm font-medium">
          If you find this tool helpful, please consider starring it on GitHub
        </span>
        <div className="flex gap-3">
          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            asChild
          >
            <a
              href="https://github.com/MarcusNeufeldt/fundingscope"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <Github className="h-4 w-4" />
              <span>Star on GitHub</span>
            </a>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            asChild
          >
            <a
              href="https://twitter.com/boederzeng1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <Twitter className="h-4 w-4" />
              <span>Follow on X</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};
