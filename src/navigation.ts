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
      title: 'Company',
      links: [
        { text: 'About Us', href: getPermalink('/about') },
        { text: 'Services', href: getPermalink('/services') },
        { text: 'Testimonials', href: getPermalink('/testimonials') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Services',
      links: [
        { text: 'E-Line', href: '/services#e-line' },
        { text: 'Slickline', href: '/services#slickline' },
        { text: 'Slick E-Line', href: '/services#slick-eline' },
        { text: 'TCP', href: '/services#tcp' },
        { text: 'View All Services', href: getPermalink('/services') },
      ],
    },
    {
      title: 'Locations',
      links: [
        { text: 'Gillette, WY (HQ)', href: '/contact#gillette' },
        { text: 'Casper, WY', href: '/contact#casper' },
        { text: 'Dickinson, ND', href: '/contact#dickinson' },
        { text: 'Williston, ND', href: '/contact#williston' },
        { text: 'Interactive Map', href: '/contact#map' },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: `© ${new Date().getFullYear()} Wood Wireline. All rights reserved. Established 1977.`,
};
