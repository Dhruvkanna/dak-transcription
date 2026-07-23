import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider, useAuth } from '@/context/AuthContext';

import Dashboard from '@/pages/Dashboard';
import Transcription from '@/pages/Transcription';
import Subtitling from '@/pages/Subtitling';
import Captioning from '@/pages/Captioning';
import Dubbing from '@/pages/Dubbing';
import History from '@/pages/History';
import Billing from '@/pages/Billing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import VerifyEmail from '@/pages/VerifyEmail';
import ForgotPassword from '@/pages/ForgotPassword';

const queryClient = new QueryClient();

function ProtectedRouter() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

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

function Router() {
  const { user, loading } = useAuth();

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login">
        {!loading && user ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/register">
        {!loading && user ? <Redirect to="/" /> : <Register />}
      </Route>
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Protected — everything else */}
      <Route>
        <ProtectedRouter />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
