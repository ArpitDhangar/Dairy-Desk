import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import Register from "./pages/Register";

const navigation = [
  {
    to: "/",
    label: "Customers",
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM1.76 16.27A7 7 0 0115 13H5a7 7 0 00-3.24 3.27zM14 13h1a7 7 0 015 2.24V16a1 1 0 01-1 1h-4.09A5.99 5.99 0 0014 13z" />
      </svg>
    ),
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    to: "/products",
    label: "Inventory",
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4zM3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
  },
  {
    to: "/payments",
    label: "Payments",
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm-2 5h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9zm3 2a1 1 0 100 2h2a1 1 0 100-2H5z" />
      </svg>
    ),
  },
  {
    to: "/expenses",
    label: "Expenses",
    icon: (
      <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
];

function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className={menuOpen ? "mobile-sidebar-backdrop active" : "mobile-sidebar-backdrop"}
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand-block">
          <div className="brand-row">
            <div>
              <h1>Dairy Desk</h1>
              {user?.firmName ? (
                <p className="sidebar-firm-name">{user.firmName}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="sidebar-close-button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm10.293 4.293a1 1 0 011.414 0L17 9.586l-2.293 2.293a1 1 0 01-1.414-1.414L14.586 9l-1.293-1.293a1 1 0 010-1.414zM10 9a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <div className="mobile-topbar">
          <strong>Dairy Desk</strong>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Customers />} />
                    <Route path="/customer/:id" element={<CustomerLedger />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/expenses" element={<Expenses />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
