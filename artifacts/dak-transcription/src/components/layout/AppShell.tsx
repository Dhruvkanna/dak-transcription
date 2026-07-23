import React from 'react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { useGetWallet } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import {
  LayoutDashboard,
  History,
  CreditCard,
  Sun,
  Moon,
  LogOut,
  User,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NewJobModal } from '@/components/NewJobModal';
import { SupportModal } from '@/components/SupportModal';

/* ─── Top Nav ─────────────────────────────────────────────── */

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { data: wallet, isLoading } = useGetWallet();

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-background border-b border-border z-40 flex items-center justify-between px-6">
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

      <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden sm:flex items-center gap-2">
          {isLoading ? (
            <div className="h-6 w-24 bg-background-3 animate-pulse rounded-md" />
          ) : wallet ? (
            <Badge variant="outline" className="font-mono text-sm bg-background-2">
              {formatCurrency(wallet.balance)}
            </Badge>
          ) : null}
        </div>

        <div className="w-px h-6 bg-border hidden sm:block" />

        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-background-2 rounded-full text-foreground-3 transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-8 h-8 rounded-full bg-background-3 flex items-center justify-center text-foreground-2">
          <User size={16} />
        </div>
      </div>
    </header>
  );
}

/* ─── Pill Sidebar ─────────────────────────────────────────── */

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'History', path: '/history', icon: History },
  { name: 'Billing', path: '/billing', icon: CreditCard },
];

function NavIcon({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Link href={item.path}>
          <div
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-150',
              isActive ? 'bg-white shadow-sm' : 'hover:bg-white/10',
            )}
          >
            <Icon
              size={19}
              className={cn(
                'transition-colors',
                isActive ? 'text-[#111]' : 'text-white/70 hover:text-white',
              )}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>{item.name}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const [jobModalOpen, setJobModalOpen] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);

  return (
    <>
      <NewJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Fixed wrapper spans below topnav to bottom — inner pill is centered */}
      <aside className="fixed left-3 top-[60px] bottom-0 z-40 flex items-center">
        <div className="bg-[#111111] rounded-[28px] py-3 px-1.5 flex flex-col items-center gap-0.5 shadow-2xl w-[56px]">

          {/* New Job — primary action */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setJobModalOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/90 hover:bg-white transition-colors mb-1 shadow-sm"
                aria-label="New Job"
              >
                <Plus size={18} className="text-[#111]" strokeWidth={2.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>New Job</TooltipContent>
          </Tooltip>

          <div className="w-5 h-px bg-white/10 my-1.5" />

          {/* Main nav */}
          {mainNavItems.map((item) => (
            <NavIcon key={item.path} item={item} isActive={location === item.path} />
          ))}

          <div className="w-5 h-px bg-white/10 my-1.5" />

          {/* Help & Support */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSupportOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors group"
                aria-label="Help & Support"
              >
                <HelpCircle size={19} className="text-white/70 group-hover:text-white transition-colors" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>Help & Support</TooltipContent>
          </Tooltip>

          <div className="w-5 h-px bg-white/10 my-1.5" />

          {/* Sign Out */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-500/20 transition-colors group"
                aria-label="Sign Out"
              >
                <LogOut size={18} className="text-white/50 group-hover:text-red-400 transition-colors" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>Sign Out</TooltipContent>
          </Tooltip>

        </div>
      </aside>
    </>
  );
}

/* ─── App Shell ────────────────────────────────────────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <div className="flex flex-1 pt-[60px]">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden ml-[76px]">
          <div className="max-w-7xl mx-auto p-4 md:p-8 w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
