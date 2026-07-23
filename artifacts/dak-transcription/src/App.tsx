import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/layout/AppShell';

import Dashboard from '@/pages/Dashboard';
import Transcription from '@/pages/Transcription';
import Subtitling from '@/pages/Subtitling';
import Captioning from '@/pages/Captioning';
import Dubbing from '@/pages/Dubbing';
import History from '@/pages/History';
import Billing from '@/pages/Billing';

const queryClient = new QueryClient();

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transcription" component={Transcription} />
        <Route path="/subtitling" component={Subtitling} />
        <Route path="/captioning" component={Captioning} />
        <Route path="/dubbing" component={Dubbing} />
        <Route path="/history" component={History} />
        <Route path="/billing" component={Billing} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
