

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; // Added useNavigate
import { createPageUrl } from "@/utils";
import { 
  Home, 
  CreditCard, 
  Tag, 
  Target, 
  TrendingUp,
  BarChart, 
  Menu,
  // User, // User icon from lucide-react, might conflict with User state
  Settings,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import { User as UserEntity } from "@/api/entities"; // Remove Base44 User entity
import { supabase } from "@/lib/supabaseClient"; // Import Supabase client

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: Home,
    color: "text-green-600",
    bgColor: "bg-green-50"
  },
  {
    title: "Contas",
    url: createPageUrl("Accounts"),
    icon: CreditCard,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  {
    title: "Tags",
    url: createPageUrl("Tags"),
    icon: Tag,
    color: "text-purple-600",
    bgColor: "bg-purple-50"
  },
  {
    title: "Orçamentos",
    url: createPageUrl("Budgets"),
    icon: Target,
    color: "text-orange-600",
    bgColor: "bg-orange-50"
  },
  {
    title: "Transações",
    url: createPageUrl("Transactions"),
    icon: TrendingUp,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50"
  },
  {
    title: "Relatórios",
    url: createPageUrl("Reports"),
    icon: BarChart,
    color: "text-teal-600",
    bgColor: "bg-teal-50"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  // Loading state for initial user fetch can be removed if ProtectedRoute handles pre-loading checks
  // const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUserAndListen = async () => {
      // Initial fetch
      const { data: { user: initialUser } } = await supabase.auth.getUser();
      setUser(initialUser);
      // setLoading(false); // setLoading can be removed

      // Listen for auth changes
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("Layout Auth event:", event, session);
        const currentUser = session?.user || null;
        setUser(currentUser);

        // If user logs out (session becomes null) and we are not on login page, redirect.
        // This is a fallback, ProtectedRoute should primarily handle unauthenticated access.
        if (!currentUser && location.pathname !== '/login') {
          navigate('/login', { replace: true });
        }
        // If user logs in (session appears) and they are somehow on login page, redirect to dashboard.
        else if (currentUser && location.pathname === '/login') {
          navigate('/', { replace: true });
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    };

    fetchUserAndListen();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
    }
    // setUser(null); // onAuthStateChange will handle this
    // navigate("/login"); // onAuthStateChange will handle this
  };

  // If there's no user object, it might mean auth state is still loading or user is logged out.
  // ProtectedRoute should prevent this component from rendering if not authenticated.
  // However, a brief null state for user might occur before the first onAuthStateChange sets it.
  // For a cleaner UI, we could show a loader if user is null, but this might flash.
  // Given ProtectedRoute, user should ideally always be populated here.
  // if (!user) {
  //   return <div className="flex items-center justify-center min-h-screen">Carregando usuário...</div>;
  // }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <style jsx>{`
          :root {
            --primary-green: #1B5E20;
            --primary-blue: #1565C0;
            --accent-color: #4CAF50;
            --text-primary: #212121;
            --text-secondary: #757575;
            --surface: #FFFFFF;
            --background: #FAFAFA;
          }
        `}</style>
        
        <Sidebar className="border-r-0 shadow-md bg-white">
          <SidebarHeader className="border-b border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-gray-900">FinanceApp</h2>
                <p className="text-sm text-gray-500">Controle Financeiro</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Menu Principal
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-1">
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`
                            h-12 rounded-xl transition-all duration-300 hover:scale-[1.02] 
                            ${isActive 
                              ? `${item.bgColor} ${item.color} shadow-md border border-opacity-20` 
                              : 'hover:bg-gray-50 text-gray-700'
                            }
                          `}
                        >
                          <Link to={item.url} className="flex items-center gap-4 px-4 py-3">
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-white bg-opacity-80' : 'bg-gray-100'}`}>
                              <item.icon className={`w-5 h-5 ${isActive ? item.color : 'text-gray-600'}`} />
                            </div>
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-100 p-4">
            {user && ( // Use logical AND to render only if user exists
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
                      {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {user.user_metadata?.full_name || user.email || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-6 py-4 md:hidden shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900">FinanceApp</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="min-h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

