import { getPermalink } from './utils/permalinks';
import type { Props as HeaderProps } from '~/components/widgets/Header.astro';

export const headerData: HeaderProps = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'About',
      href: getPermalink('/about'),
    },
    {
      text: 'Services',
      href: getPermalink('/services'),
      links: [
        { text: 'All Services', href: getPermalink('/services') },
        { text: 'E-Line', href: '/services/#e-line' },
        { text: 'Slickline', href: '/services/#slickline' },
        { text: 'Slick E-Line', href: '/services/#slick-eline' },
        { text: 'Swabbing', href: '/services/#swabbing' },
        { text: 'TCP', href: '/services/#tcp' },
        { text: 'Plug & Abandonment', href: '/services/#plug-abandonment' },
        { text: 'Cameras', href: '/services/#cameras' },
        { text: 'Fishing', href: '/services/#fishing' },
        { text: 'Kinley Cutter', href: '/services/#kinley' },
        { text: 'Hydrotesting', href: '/services/#hydrotesting' },
      ],
    },
    {
      text: 'Locations',
      href: '/contact/#map',
    },
    // HIDDEN UNTIL CLIENT READY
    // {
    //   text: 'Testimonials',
    //   href: getPermalink('/testimonials'),
    // },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
    {
      text: 'Apply',
      href: getPermalink('/apply'),
    },
  ],
  actions: [{ text: 'Get Quote', href: getPermalink('/contact'), variant: 'primary' }],
};

export const footerData = {
  links: [
    {
      title: 'Company',
      links: [
        { text: 'About Us', href: getPermalink('/about') },
        { text: 'Services', href: getPermalink('/services') },
        // HIDDEN UNTIL CLIENT READY
        // { text: 'Testimonials', href: getPermalink('/testimonials') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Services',
      links: [
        { text: 'E-Line', href: '/services/#e-line' },
        { text: 'Slickline', href: '/services/#slickline' },
        { text: 'Slick E-Line', href: '/services/#slick-eline' },
        { text: 'TCP', href: '/services/#tcp' },
        { text: 'View All Services', href: getPermalink('/services') },
      ],
    },
    {
      title: 'Locations',
      links: [
        { text: 'Gillette, WY (HQ)', href: '/contact/#gillette' },
        { text: 'Casper, WY', href: '/contact/#casper' },
        { text: 'Dickinson, ND', href: '/contact/#dickinson' },
        { text: 'Williston, ND', href: '/contact/#williston' },
        { text: 'Interactive Map', href: '/contact/#map' },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: 'https://www.facebook.com/profile.php?id=61574999590044' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: 'https://www.instagram.com/woodwireline/' },
    { ariaLabel: 'TikTok', icon: 'tabler:brand-tiktok', href: 'https://www.tiktok.com/@woodwireline' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/company/wood-wireline-service-inc/?viewAsMember=true' },
    { ariaLabel: 'YouTube', icon: 'tabler:brand-youtube', href: 'https://www.youtube.com/@WoodWireline' },
    { ariaLabel: 'Linktree', icon: 'tabler:tree', href: '#' },
  ],
  footNote: `© ${new Date().getFullYear()} Wood Wireline. All rights reserved. Established 1977.`,
};
