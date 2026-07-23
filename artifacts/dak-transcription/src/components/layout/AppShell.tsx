import React from 'react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { useGetWallet } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Subtitles,
  MonitorPlay,
  Mic2,
  History,
  CreditCard,
  Sun,
  Moon,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function TopNav({ toggleSidebar, sidebarOpen }: { toggleSidebar: () => void, sidebarOpen: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { data: wallet, isLoading } = useGetWallet();

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-background border-b border-border z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-background-2 rounded-md md:hidden text-foreground-2"
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-serif font-bold text-lg leading-none pt-0.5">
              D
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-bold text-xl tracking-tight leading-none pt-0.5">DAK</span>
              <span className="text-sm font-medium text-foreground-3 hidden sm:inline-block">Transcription</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden sm:flex items-center gap-2">
          {isLoading ? (
            <div className="h-6 w-24 bg-background-3 animate-pulse rounded-md"></div>
          ) : wallet ? (
            <>
              <Badge variant="outline" className="font-mono text-sm bg-background-2">
                {formatCurrency(wallet.balance)}
              </Badge>
              <Badge variant="info" className="uppercase text-[10px] tracking-wider">
                {wallet.planType} PLAN
              </Badge>
            </>
          ) : null}
        </div>

        <div className="w-px h-6 bg-border hidden sm:block"></div>

        <button 
          onClick={toggleTheme}
          className="p-2 hover:bg-background-2 rounded-full text-foreground-3 transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-background-3 flex items-center justify-center text-foreground-2">
            <User size={16} />
          </div>
        </div>
      </div>
    </header>
  );
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Transcription', path: '/transcription', icon: FileText },
  { name: 'Subtitling', path: '/subtitling', icon: Subtitles },
  { name: 'Captioning', path: '/captioning', icon: MonitorPlay },
  { name: 'AI Dubbing', path: '/dubbing', icon: Mic2 },
  { name: 'History', path: '/history', icon: History },
  { name: 'Billing', path: '/billing', icon: CreditCard },
];

export function Sidebar({ open, setOpen }: { open: boolean, setOpen: (o: boolean) => void }) {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
      
      <aside 
        className={cn(
          "fixed top-[60px] bottom-0 left-0 bg-background-2 border-r border-border z-40 transition-all duration-300 ease-in-out overflow-y-auto flex flex-col",
          open ? "w-[256px] translate-x-0" : "w-[64px] -translate-x-full md:translate-x-0"
        )}
      >
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all group",
                    isActive 
                      ? "bg-background shadow-sm text-primary font-medium" 
                      : "text-foreground-3 hover:bg-background/50 hover:text-foreground"
                  )}
                  title={!open ? item.name : undefined}
                  onClick={() => window.innerWidth < 768 && setOpen(false)}
                >
                  <Icon size={18} className={cn("shrink-0", isActive ? "text-accent" : "text-foreground-4 group-hover:text-foreground-3")} />
                  <span className={cn(
                    "truncate transition-opacity duration-200",
                    !open && "opacity-0 md:hidden"
                  )}>
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border/50">
          <button className={cn(
            "flex items-center gap-3 px-3 py-2 text-foreground-3 hover:text-danger hover:bg-danger-bg rounded-md w-full transition-colors",
            !open && "justify-center px-0 md:justify-start md:px-3"
          )}>
            <LogOut size={18} className="shrink-0" />
            <span className={cn("truncate", !open && "hidden")}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Auto-collapse sidebar on mobile
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1 pt-[60px]">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main 
          className={cn(
            "flex-1 overflow-x-hidden transition-all duration-300 ease-in-out relative",
            sidebarOpen ? "md:ml-[256px]" : "md:ml-[64px]"
          )}
        >
          <div className="max-w-7xl mx-auto p-4 md:p-8 w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
