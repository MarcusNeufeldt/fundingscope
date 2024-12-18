import React from "react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";

export const HowToUseSheet = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-help-circle"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          How To Use
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90%] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>How To Use FundingScope</SheetTitle>
          <SheetDescription>
            Learn how to analyze and optimize your trading positions
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-180px)] mt-6 pr-4">
          <div className="space-y-6">
            <section>
              <h3 className="font-semibold mb-2">1. Select Trading Pair</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                <li>Choose from available perpetual pairs</li>
                <li>View current market price</li>
                <li>Monitor live funding rates</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Configure Position</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                <li>Set your investment amount</li>
                <li>Adjust leverage (1x-125x)</li>
                <li>Define your target price</li>
                <li>Set your intended holding period</li>
                <li>Review current funding rate</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. Analyze Scenarios</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                <li>Compare different market patterns</li>
                <li>View projected outcomes</li>
                <li>Assess funding impact</li>
                <li>Monitor risk metrics</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Review Recommendations</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                <li>Position optimization tips</li>
                <li>Risk warnings</li>
                <li>Timing suggestions</li>
                <li>Strategy adjustments</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">Key Features</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                <li>Real-time market data tracking</li>
                <li>Advanced scenario analysis</li>
                <li>Comprehensive position analysis</li>
                <li>Interactive visualizations</li>
                <li>Smart recommendations</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
