import Link from "next/link";
import { Clapperboard, CheckSquare, ListVideo, LineChart, Lightbulb, FileText } from "lucide-react";

export function Sidebar() {
  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <span className="text-xl font-bold tracking-tight text-red-600">hoichoi</span>
        <span className="text-xl font-medium tracking-tight text-zinc-100 ml-1">studio</span>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
        <NavItem href="/studio" icon={<Clapperboard className="w-4 h-4" />} label="Studio" />
        <NavItem href="/review" icon={<CheckSquare className="w-4 h-4" />} label="Review" />
        <NavItem href="/queue" icon={<ListVideo className="w-4 h-4" />} label="Queue" />
        <NavItem href="/analytics" icon={<LineChart className="w-4 h-4" />} label="Analytics" />
        <NavItem href="/insights" icon={<Lightbulb className="w-4 h-4" />} label="Insights" />
        <NavItem href="/report" icon={<FileText className="w-4 h-4" />} label="Report" />
      </nav>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
