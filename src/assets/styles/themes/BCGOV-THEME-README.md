# BC Gov Bootstrap Theme

A reusable Bootstrap 5.3+ theme for British Columbia Government projects.

## Features

✅ **BC Gov Branding**
- Official BC Gov color palette (#003366, #38598A, #FCBA19)
- BCSans typography
- Consistent design patterns

✅ **Bootstrap 5.3+ Compatible**
- CSS variables only (no Sass required)
- Works with compiled Bootstrap CSS
- Uses increased specificity (no !important flags)

✅ **Comprehensive Components**
- Buttons (primary, outline, all states)
- Cards, Tables, Forms
- Modals, Pagination, Lists
- Utility classes

## Installation

### 1. Add Bootstrap CSS

```html
<!-- Via CDN -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3/dist/css/bootstrap.min.css" rel="stylesheet">
```

Or via npm:
```bash
npm install bootstrap
```

### 2. Add BCSans Font

Download BCSans fonts and include:
```css
@import url("path/to/BCSans.css");
```

### 3. Add BC Gov Theme

```css
@import url("path/to/bcgov-bootstrap-theme.css");
```

## Usage

### Basic Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BC Gov Application</title>
  
  <!-- 1. Bootstrap CSS -->
  <link href="bootstrap.min.css" rel="stylesheet">
  
  <!-- 2. BC Gov Theme -->
  <link href="bcgov-bootstrap-theme.css" rel="stylesheet">
  
  <!-- 3. Your custom styles (optional) -->
  <link href="custom.css" rel="stylesheet">
</head>
<body>
  <h1>BC Gov Application</h1>
  <button class="btn btn-primary">Primary Button</button>
  <button class="btn btn-outline-primary">Outline Button</button>
</body>
</html>
```

### Angular Projects

In `angular.json`:
```json
{
  "styles": [
    "node_modules/bootstrap/dist/css/bootstrap.min.css",
    "src/assets/styles/bcgov-bootstrap-theme.css",
    "src/styles.css"
  ]
}
```

Or in `styles.css`:
```css
@import "bootstrap/dist/css/bootstrap.min.css";
@import "assets/styles/bcgov-bootstrap-theme.css";
```

## Color Palette

### CSS Variables

```css
/* BC Gov Official Colors */
--bc-blue: #003366;              /* Official blue */
--bc-blue-interactive: #38598A;  /* Interactive elements */
--bc-blue-light: #5091CD;        /* Light blue */
--bc-gold: #FCBA19;              /* BC Gold */

/* Neutrals */
--bc-gray: #494949;              /* Body text */
--bc-gray-medium: #666;          /* Secondary text */
--bc-gray-light: #F7F8FA;        /* Light backgrounds */
```

### Bootstrap Mapping

```css
--bs-primary: #38598A;    /* Interactive blue */
--bs-secondary: #003366;  /* Official blue */
--bs-warning: #FCBA19;    /* BC Gold */
```

## Components

### Buttons

```html
<!-- Primary button - BC Gov interactive blue -->
<button class="btn btn-primary">Primary</button>

<!-- Outline button - BC Gov official blue -->
<button class="btn btn-outline-primary">Outline</button>

<!-- Secondary button -->
<button class="btn btn-secondary">Secondary</button>

<!-- Warning button - BC Gold -->
<button class="btn btn-warning">Warning</button>
```

### Cards

```html
<div class="card">
  <div class="card-header">BC Gov Card</div>
  <div class="card-body">
    <p>Card content here</p>
  </div>
</div>
```

### Tables

```html
<table class="table table-striped">
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
    </tr>
  </tbody>
</table>
```

### Utility Classes

```html
<!-- Backgrounds -->
<div class="bg-bc-blue">BC Gov Blue Background</div>
<div class="bg-bc-gold">BC Gold Background</div>

<!-- Text Colors -->
<p class="text-bc-blue">BC Gov Blue Text</p>
<p class="text-bc-gold">BC Gold Text</p>

<!-- Borders -->
<div class="border border-bc-blue">BC Gov Blue Border</div>
```

## Customization

### Project-Specific Overrides

Create a project-specific CSS file that loads after the theme:

```css
/* project-custom.css */

/* Override container width */
.container {
  max-width: 1100px;
}

/* Add custom button variant */
.btn-custom {
  background-color: #custom-color;
  color: white;
}

/* Custom component styles */
.my-component {
  /* ... */
}
```

Load order:
```css
@import "bcgov-bootstrap-theme.css";    /* BC Gov standard */
@import "project-custom.css";           /* Project-specific */
```

### Accessing Variables

Use CSS variables in your custom styles:

```css
.my-component {
  color: var(--bc-blue);
  background: var(--bc-gray-light);
  border: 1px solid var(--bc-blue-interactive);
}

.my-button {
  background: var(--bs-primary);
  color: white;
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Requires CSS custom properties (variables) support.

## Best Practices

### ✅ DO

- Load Bootstrap CSS before this theme
- Use CSS variables for colors
- Use Bootstrap utility classes when possible
- Test accessibility (WCAG AA minimum)

### ❌ DON'T

- Don't use `!important` (theme uses specificity)
- Don't hardcode BC Gov colors (use variables)
- Don't modify the theme file directly
- Don't load theme before Bootstrap

## Migration Guide

### From Old EAGLE Theme

**Before:**
```css
@import "bootstrap-override.css";
@import "default.css";
@import "buttons.css";
```

**After:**
```css
@import "bcgov-bootstrap-theme.css";  /* All BC Gov styles */
@import "project-custom.css";         /* Project-specific only */
```

### Variable Mapping

| Old Variable | New Variable |
|-------------|-------------|
| `--primary: #003366` | `--bc-blue` or `--bs-secondary` |
| `--gold: #fcba19` | `--bc-gold` or `--bs-warning` |
| `#38598a` | `--bc-blue-interactive` or `--bs-primary` |

## License

This theme follows BC Government digital standards and design guidelines.

## Support

For issues or questions:
- Open an issue in the repository
- Contact the BC Gov Digital Services Team

## Version History

### 1.0.0 (January 2026)
- Initial release
- Bootstrap 5.3+ compatibility
- Complete BC Gov branding
- All standard components
- Utility classes
