# Deploying the Doggy&Tutu Trade Website

This guide explains how to deploy the website to various hosting platforms.

## GitHub Pages

1. Push the `website` directory to your repository
2. Go to repository Settings > Pages
3. Set Source to "Deploy from a branch" 
4. Choose `main` branch and `/website` folder
5. Your site will be available at `https://username.github.io/repository-name`

## Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: (leave empty)
3. Set publish directory: `website`
4. Deploy

## Vercel

1. Import your GitHub repository
2. Set Framework Preset: "Other"
3. Set Output Directory: `website`
4. Deploy

## Static File Hosting

For any static file hosting service:
1. Upload the contents of the `website` directory
2. Ensure `index.html` is in the root
3. Set up custom domain if desired

## Custom Domain Setup

If you want to use a custom domain:
1. Add a `CNAME` file to the `website` directory with your domain
2. Configure DNS records with your domain provider
3. Enable HTTPS if supported by your hosting platform

## CDN Resources

The website uses CDN resources for:
- TailwindCSS
- DaisyUI  
- Alpine.js

These load from external CDNs, so internet connectivity is required for full functionality.

## Future Updates

When releases become available:
1. Update download links in `index.html`
2. Remove the "Coming Soon" alerts
3. Add real download URLs from GitHub releases
4. Update version numbers if needed