# IT Support System - Modern Design System Specification

## Overview
This document outlines the design system for modernizing the IT Support System frontend interface using Tailwind CSS and modern design principles.

## Design Philosophy
- **Mobile-First**: Responsive design starting from mobile devices
- **Accessibility-First**: WCAG 2.1 AA compliance
- **Component-Based**: Reusable UI components
- **Modern Aesthetics**: Clean, professional interface with subtle animations

## Color Palette

### Primary Colors
- **Primary Blue**: `#3B82F6` (Blue-500)
- **Primary Dark**: `#1E40AF` (Blue-700)
- **Primary Light**: `#DBEAFE` (Blue-100)

### Secondary Colors
- **Success Green**: `#10B981` (Emerald-500)
- **Warning Orange**: `#F59E0B` (Amber-500)
- **Error Red**: `#EF4444` (Red-500)
- **Info Blue**: `#06B6D4` (Cyan-500)

### Neutral Colors
- **Gray Scale**: 
  - 50: `#F9FAFB`
  - 100: `#F3F4F6`
  - 200: `#E5E7EB`
  - 300: `#D1D5DB`
  - 400: `#9CA3AF`
  - 500: `#6B7280`
  - 600: `#4B5563`
  - 700: `#374151`
  - 800: `#1F2937`
  - 900: `#111827`

### Dark Mode Colors
- **Background**: `#0F172A` (Slate-900)
- **Surface**: `#1E293B` (Slate-800)
- **Border**: `#334155` (Slate-700)
- **Text Primary**: `#F1F5F9` (Slate-100)
- **Text Secondary**: `#CBD5E1` (Slate-300)

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, -apple-system, sans-serif

### Font Sizes
- **Display Large**: `text-4xl` (36px)
- **Display Medium**: `text-3xl` (30px)
- **Display Small**: `text-2xl` (24px)
- **Heading Large**: `text-xl` (20px)
- **Heading Medium**: `text-lg` (18px)
- **Heading Small**: `text-base` (16px)
- **Body Large**: `text-base` (16px)
- **Body Medium**: `text-sm` (14px)
- **Body Small**: `text-xs` (12px)
- **Caption**: `text-xs` (12px)

### Font Weights
- **Light**: `font-light` (300)
- **Normal**: `font-normal` (400)
- **Medium**: `font-medium` (500)
- **Semibold**: `font-semibold` (600)
- **Bold**: `font-bold` (700)

## Spacing System
Based on Tailwind's spacing scale (4px base unit):
- **xs**: `space-1` (4px)
- **sm**: `space-2` (8px)
- **md**: `space-4` (16px)
- **lg**: `space-6` (24px)
- **xl**: `space-8` (32px)
- **2xl**: `space-12` (48px)
- **3xl**: `space-16` (64px)

## Component Library

### 1. Navigation Components

#### Header/Navbar
```html
<header class="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <!-- Logo -->
      <div class="flex-shrink-0">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">IT Support System</h1>
      </div>
      
      <!-- Desktop Navigation -->
      <nav class="hidden md:flex space-x-8">
        <a href="#" class="nav-link">Dashboard</a>
        <a href="#" class="nav-link">Tickets</a>
        <a href="#" class="nav-link">Assets</a>
        <a href="#" class="nav-link">Reports</a>
      </nav>
      
      <!-- User Menu -->
      <div class="flex items-center space-x-4">
        <button class="theme-toggle">🌙</button>
        <button class="user-menu">👤 Admin</button>
        <button class="logout-btn">🚪</button>
      </div>
    </div>
  </div>
</header>
```

#### Mobile Navigation
```html
<div class="md:hidden">
  <button class="mobile-menu-btn">☰</button>
  <div class="mobile-menu">
    <a href="#" class="mobile-nav-link">Dashboard</a>
    <a href="#" class="mobile-nav-link">Tickets</a>
    <a href="#" class="mobile-nav-link">Assets</a>
    <a href="#" class="mobile-nav-link">Reports</a>
  </div>
</div>
```

### 2. Card Components

#### Basic Card
```html
<div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
  <div class="p-6">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Card Title</h3>
    <p class="mt-2 text-gray-600 dark:text-gray-300">Card content goes here</p>
  </div>
</div>
```

#### Stat Card
```html
<div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
  <div class="flex items-center">
    <div class="flex-shrink-0">
      <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
        <span class="text-blue-600 dark:text-blue-400">📊</span>
      </div>
    </div>
    <div class="ml-4">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Open Tickets</p>
      <p class="text-2xl font-bold text-gray-900 dark:text-white">12</p>
    </div>
  </div>
</div>
```

### 3. Form Components

#### Input Field
```html
<div class="form-group">
  <label class="form-label">Email Address</label>
  <input type="email" class="form-input" placeholder="Enter your email">
  <p class="form-help">We'll never share your email with anyone else.</p>
</div>
```

#### Button Variants
```html
<!-- Primary Button -->
<button class="btn btn-primary">Primary Action</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Secondary Action</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>

<!-- Success Button -->
<button class="btn btn-success">Save Changes</button>
```

### 4. Table Components

#### Data Table
```html
<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
    <thead class="bg-gray-50 dark:bg-slate-800">
      <tr>
        <th class="table-header">Ticket #</th>
        <th class="table-header">Subject</th>
        <th class="table-header">Requester</th>
        <th class="table-header">Priority</th>
        <th class="table-header">Status</th>
        <th class="table-header">Actions</th>
      </tr>
    </thead>
    <tbody class="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
      <tr class="table-row">
        <td class="table-cell">#TKT-001</td>
        <td class="table-cell">Laptop not connecting to Wi-Fi</td>
        <td class="table-cell">Sarah Johnson</td>
        <td class="table-cell"><span class="badge badge-high">High</span></td>
        <td class="table-cell"><span class="badge badge-progress">In Progress</span></td>
        <td class="table-cell">
          <button class="btn btn-sm btn-primary">View</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 5. Status and Badge Components

#### Priority Badges
```html
<span class="badge badge-high">High Priority</span>
<span class="badge badge-medium">Medium Priority</span>
<span class="badge badge-low">Low Priority</span>
```

#### Status Badges
```html
<span class="badge badge-open">Open</span>
<span class="badge badge-progress">In Progress</span>
<span class="badge badge-resolved">Resolved</span>
<span class="badge badge-closed">Closed</span>
```

### 6. Modal Components

#### Basic Modal
```html
<div class="modal-overlay">
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">Modal Title</h3>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <p>Modal content goes here</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

## Layout Templates

### 1. Dashboard Layout
```html
<div class="min-h-screen bg-gray-50 dark:bg-slate-900">
  <!-- Header -->
  <header class="bg-white dark:bg-slate-800 shadow-sm">
    <!-- Navigation content -->
  </header>
  
  <!-- Main Content -->
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">Overview of your IT support system</p>
    </div>
    
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Stat cards -->
    </div>
    
    <!-- Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Content cards -->
    </div>
  </main>
</div>
```

### 2. Form Layout
```html
<div class="max-w-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Create New Ticket</h2>
    </div>
    <form class="p-6 space-y-6">
      <!-- Form fields -->
    </form>
  </div>
</div>
```

## Responsive Breakpoints
- **Mobile**: `sm:` (640px+)
- **Tablet**: `md:` (768px+)
- **Desktop**: `lg:` (1024px+)
- **Large Desktop**: `xl:` (1280px+)
- **Extra Large**: `2xl:` (1536px+)

## Animation and Transitions
- **Duration**: 150ms for micro-interactions, 300ms for page transitions
- **Easing**: `ease-in-out` for smooth, natural feel
- **Hover Effects**: Subtle scale and shadow changes
- **Loading States**: Skeleton screens and spinners

## Accessibility Features
- **Focus Indicators**: High contrast focus rings
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: Proper ARIA labels and landmarks
- **Color Contrast**: WCAG AA compliant ratios
- **Reduced Motion**: Respect user preferences

## Implementation Notes
1. Use Tailwind CSS utility classes for rapid development
2. Create custom CSS components for complex interactions
3. Implement dark mode using Tailwind's dark: variant
4. Ensure all components are accessible by default
5. Test across different browsers and devices
6. Optimize for performance with proper CSS purging

This design system provides a solid foundation for modernizing the IT Support System interface with a professional, accessible, and responsive design. 