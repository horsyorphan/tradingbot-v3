# Doggy&Tutu Trade Website

This directory contains the marketing website for the Doggy&Tutu Trade application.

## Files

- **index.html** - Main website page with all sections
- **assets/** - Website assets including logo and images

## Features

The website includes:

### Sections
- **Hero Section** - Main intro with download buttons
- **Features Section** - Key application features showcase
- **Download Section** - Platform-specific download options
- **About Section** - Application overview and getting started guide

### Technical Features
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Theme** - Matches the application's default theme
- **Interactive Elements** - Download modals, smooth scrolling, hover effects
- **Modern UI** - Built with TailwindCSS and DaisyUI
- **Alpine.js** - Lightweight JavaScript framework for interactivity

### Download Functionality
- Mac and Windows download buttons
- Modal dialogs with platform-specific options
- Links to GitHub repository for source builds
- System requirements information

## Theme Consistency

The website uses the same design language as the main application:
- **DaisyUI Dark Theme** - Consistent with app default
- **Logo Integration** - Uses the same logo.png from the app
- **Color Scheme** - Matches the app's primary and secondary colors
- **Typography** - Similar font styling and hierarchy

## Usage

To view the website locally:

1. Open `index.html` in any modern web browser
2. No build process required - uses CDN resources
3. All assets are self-contained in this directory

## Deployment

This website can be easily deployed to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

Simply upload the `website` directory contents to your hosting provider.

## Customization

To update download links when releases are available:
1. Edit the modal content in `index.html`
2. Update the disabled buttons to working download links
3. Add actual download URLs from GitHub releases

## Dependencies

The website uses CDN resources:
- TailwindCSS 3.x
- DaisyUI 4.4.24
- Alpine.js 3.x

No build process or npm installation required.