import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Payments from "./pages/Payments";

const navigation = [
  { to: "/", label: "Customers", hint: "" },
  { to: "/dashboard", label: "Dashboard", hint: "" },
  { to: "/products", label: "Inventory", hint: "" },
  { to: "/payments", label: "Payments", hint: "" },
];

function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

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
              <p className="eyebrow">Dairy Desk</p>
              <h1>Dairy Desk</h1>
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
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              <span>{item.label}</span>
              {item.hint ? <small>{item.hint}</small> : null}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <div className="mobile-topbar">
          <div>
            <p className="eyebrow">Dairy Desk</p>
            <strong>Dairy Desk</strong>
          </div>
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

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Customers />} />
          <Route path="/customer/:id" element={<CustomerLedger />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/payments" element={<Payments />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
