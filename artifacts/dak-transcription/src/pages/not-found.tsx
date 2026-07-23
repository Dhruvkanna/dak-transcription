import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-full flex items-center justify-center p-4 page-enter">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-4xl font-serif font-bold mb-2">404</h1>
          <p className="text-foreground-3 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <button className="bg-primary text-primary-foreground h-10 px-6 rounded-md font-medium hover:bg-primary/90 transition-colors">
              Return to Dashboard
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
