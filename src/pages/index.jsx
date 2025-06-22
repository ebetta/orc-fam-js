import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Accounts from "./Accounts";

import Tags from "./Tags";

import Transactions from "./Transactions";

import Budgets from "./Budgets";

import Reports from "./Reports";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Accounts: Accounts,
    
    Tags: Tags,
    
    Transactions: Transactions,
    
    Budgets: Budgets,
    
    Reports: Reports,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Accounts" element={<Accounts />} />
                
                <Route path="/Tags" element={<Tags />} />
                
                <Route path="/Transactions" element={<Transactions />} />
                
                <Route path="/Budgets" element={<Budgets />} />
                
                <Route path="/Reports" element={<Reports />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}