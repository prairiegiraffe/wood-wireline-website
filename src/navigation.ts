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
    },
    {
      text: 'Locations',
      href: '/contact#map',
    },
    {
      text: 'Testimonials',
      href: getPermalink('/testimonials'),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Get Quote', href: getPermalink('/contact'), variant: 'primary' }],
};

export const footerData = {
  links: [
    {
      title: 'Services',
      links: [
        { text: 'E-Line Logging', href: getPermalink('/services#e-line') },
        { text: 'Slickline', href: getPermalink('/services#slickline') },
        { text: 'Swabbing', href: getPermalink('/services#swabbing') },
        { text: 'Perforating', href: getPermalink('/services#perforating') },
        { text: 'Plug & Abandonment', href: getPermalink('/services#p-a') },
        { text: 'Hydrotesting', href: getPermalink('/services#hydrotesting') },
      ],
    },
    {
      title: 'Service Areas',
      links: [
        { text: 'Gillette, WY', href: '/contact#gillette' },
        { text: 'Casper, WY', href: '/contact#casper' },
        { text: 'Dickinson, ND', href: '/contact#dickinson' },
        { text: 'Williston, ND', href: '/contact#williston' },
        { text: 'View All Locations', href: '/contact#map' },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About Us', href: getPermalink('/about') },
        { text: 'Our Mission', href: getPermalink('/about#mission') },
        { text: 'Our Values', href: getPermalink('/about#values') },
        { text: 'Testimonials', href: getPermalink('/testimonials') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: `
    © ${new Date().getFullYear()} Wood Wireline · Established 1977 · All rights reserved.<br>
    3106 East 2nd Street, Gillette, WY · <a href="tel:307-682-0143" class="text-blue-600 underline dark:text-muted">307-682-0143</a>
  `,
};
