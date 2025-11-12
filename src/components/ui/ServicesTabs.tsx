import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

interface Service {
  id: string;
  name: string;
  icon: string;
  description: string;
  details: string[];
}

// Icon component for rendering Tabler icons in React
const Icon = ({ name, className = 'w-6 h-6' }: { name: string; className?: string }) => {
  // Tabler icon SVG paths - proper format
  const iconMap: Record<string, string> = {
    'tabler:chart-line': 'M3 3v18h18 M18 7l-5 5-4-4-3 3',
    'tabler:link': 'M10 14a3.5 3.5 0 0 0 5 0l4 -4a3.5 3.5 0 0 0 -5 -5l-.5 .5 M14 10a3.5 3.5 0 0 0 -5 0l-4 4a3.5 3.5 0 0 0 5 5l.5 -.5',
    'tabler:droplet': 'M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -1.023 -2.174 -1.023c-.886 0 -1.754 .398 -2.174 1.023l-4.89 7.26c-1.695 2.838 -1.036 6.441 1.566 8.546z',
    'tabler:target': 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'tabler:lock': 'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0 M8 11v-4a4 4 0 1 1 8 0v4',
    'tabler:shield-lock': 'M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3 M12 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 12l0 2.5',
    'tabler:gauge': 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M12 3v2 M12 19v2 M5 12h-2 M19 12h-2 M7.1 7.1l-1.4 1.4 M16.9 7.1l1.4 1.4 M7.1 16.9l-1.4 1.4 M16.9 16.9l1.4 1.4',
    'tabler:plug-connected': 'M7 12l5 5l-1.5 1.5a5 5 0 1 1 -7 -7l1.5 -1.5z M17 12l-5 -5l1.5 -1.5a5 5 0 1 1 7 7l-1.5 1.5z M3 21l2.5 -2.5 M18.5 5.5l2.5 -2.5 M10 11l-2 2 M13 14l-2 2',
    'tabler:camera': 'M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2z M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
    'tabler:tool': 'M7 10h3v-3l-3-3-3 3v3z M10 7l3-3 3 3 M7 10l-3 3 3 3 M10 7l3 3-3 3',
    'tabler:bolt': 'M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11z',
    'tabler:arrow-up': 'M12 5l0 14 M18 11l-6 -6 M6 11l6 -6',
    'tabler:fish': 'M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571 M2 9.504c7.715 8.647 14.75 10.265 20 2.498 M18 11v.01 M11.5 10.5c-.667 1 -.667 2 0 3 M3.499 8.5c.667 1 .667 2 0 3 M8.5 7.5l-1.5 4.5 M15.988 12.917l.503 -1.917l-1.5 -4.5',
    'tabler:wave': 'M3 12c.777 -2.048 2.17 -4.095 4.818 -5.818c2.648 -1.723 5.675 -2.182 8.182 -1.818c2.507 .364 4.926 1.362 7.227 2.944c2.3 1.582 4.545 3.782 6.773 6.818',
    'tabler:scissors': 'M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M8.6 8.6l10.4 10.4 M15.4 8.6l-10.4 10.4',
  };

  const iconPath = iconMap[name] || iconMap['tabler:tool'];
  const paths = iconPath.includes(' M') 
    ? iconPath.split(' M').map((p, i) => (i === 0 ? p : 'M' + p))
    : [iconPath];
  
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((path, i) => (
        <path key={i} d={path.trim()} />
      ))}
    </svg>
  );
};

const services: Service[] = [
  {
    id: 'e-line',
    name: 'E-Line: Logging',
    icon: 'tabler:chart-line',
    description: 'Professional logging services using advanced wireline technology for accurate formation evaluation.',
    details: [
      'Advanced wireline logging technology',
      'Real-time data acquisition',
      '7-conductor wireline capabilities',
    ],
  },
  {
    id: 'slickline',
    name: 'Slickline',
    icon: 'tabler:link',
    description: 'Efficient slickline services for well intervention, maintenance, and data collection operations.',
    details: [
      'Well intervention services',
      'Maintenance operations',
      '24/7 availability',
    ],
  },
  {
    id: 'swabbing',
    name: 'Swabbing',
    icon: 'tabler:droplet',
    description: 'Expert swabbing services to remove fluids and restore well production efficiently.',
    details: [
      'Fluid removal services',
      'Production restoration',
      'Quick turnaround',
    ],
  },
  {
    id: 'perforating',
    name: 'Perforating',
    icon: 'tabler:target',
    description: 'Precision perforating services to optimize well completion and production performance.',
    details: [
      'Precision perforating systems',
      'TCP (Tubing Conveyed Perforating)',
      'Safety-focused operations',
    ],
  },
  {
    id: 'plugs-packers',
    name: 'Setting Plugs & Packers',
    icon: 'tabler:lock',
    description: 'Professional setting of plugs and packers for well isolation and completion operations.',
    details: [
      'Expert plug and packer setting',
      'Well isolation services',
      'Reliable sealing solutions',
    ],
  },
  {
    id: 'p-a',
    name: 'Plug & Abandonment',
    icon: 'tabler:shield-lock',
    description: 'Safe and compliant plug and abandonment services following industry best practices.',
    details: [
      'Regulatory compliance',
      'Safe abandonment procedures',
      'Full documentation',
    ],
  },
  {
    id: 'hydrotesting',
    name: 'Hydrotesting',
    icon: 'tabler:gauge',
    description: 'Reliable hydrotesting services to ensure equipment integrity and safety compliance.',
    details: [
      'Equipment integrity testing',
      'Safety compliance',
      'Certified testing',
    ],
  },
  {
    id: 'slick-e-line',
    name: 'Slick E-Line',
    icon: 'tabler:plug-connected',
    description: 'Our newest addition: Combined slickline and e-line capabilities for versatile operations.',
    details: [
      'Combined capabilities',
      'Latest technology',
      'Innovative solutions',
    ],
  },
  {
    id: 'cameras',
    name: 'Cameras',
    icon: 'tabler:camera',
    description: 'Downhole camera services for visual inspection and diagnostics.',
    details: [
      'High-resolution cameras',
      'Visual inspection',
      'Real-time video feed',
    ],
  },
  {
    id: 'pipe-recovery',
    name: 'Pipe Recovery',
    icon: 'tabler:tool',
    description: 'Expert pipe recovery services to retrieve stuck or lost pipe from wellbores.',
    details: [
      'Specialized recovery tools',
      'Minimized downtime',
      'Experienced crews',
    ],
  },
  {
    id: 'hepta-line',
    name: '7-Conductor Wireline',
    icon: 'tabler:bolt',
    description: 'Advanced 7-conductor wireline services for high-performance logging operations.',
    details: [
      '7-conductor wireline technology',
      'Multi-conductor capabilities',
      'Advanced logging services',
    ],
  },
  {
    id: 'hoisting',
    name: 'Third Party Hoisting',
    icon: 'tabler:arrow-up',
    description: 'Professional third-party hoisting services for various well operations.',
    details: [
      'Professional hoisting equipment',
      'Versatile service capabilities',
      'Safe operations',
    ],
  },
  {
    id: 'fishing',
    name: 'Fishing',
    icon: 'tabler:fish',
    description: 'Expert fishing services to recover lost or stuck equipment from wellbores.',
    details: [
      'Specialized fishing tools',
      'Expert recovery techniques',
      'Minimized operational impact',
    ],
  },
  {
    id: 'flow-diagnostics',
    name: 'Flow Diagnostics',
    icon: 'tabler:wave',
    description: 'Comprehensive flow diagnostics to analyze well performance and production characteristics.',
    details: [
      'Flow analysis services',
      'Production diagnostics',
      'Performance evaluation',
    ],
  },
  {
    id: 'tcp',
    name: 'TCP',
    icon: 'tabler:bolt',
    description: 'Tubing Conveyed Perforating services for efficient well completion.',
    details: [
      'Tubing conveyed systems',
      'Efficient completion',
      'Precision perforating',
    ],
  },
  {
    id: 'kinley-cutter',
    name: 'Kinley Cutter',
    icon: 'tabler:scissors',
    description: 'Specialized Kinley cutter services for pipe cutting operations.',
    details: [
      'Kinley cutter technology',
      'Precision cutting',
      'Safe operations',
    ],
  },
];

export default function ServicesTabs() {
  return (
    <div className="w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        <div className="text-center mb-16">
          <p className="text-base font-semibold text-secondary dark:text-blue-200 uppercase tracking-wide mb-2">
            Our Services
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight dark:text-white mb-6">
            Comprehensive Wireline Solutions
          </h2>
          <p className="text-xl text-muted dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Click on any service below to learn more about our capabilities and expertise. Each service is backed by decades of experience and the highest safety standards.
          </p>
        </div>

        <TabGroup>
          <div className="overflow-x-hidden">
            <TabList className="flex flex-wrap justify-center gap-3 mb-12 border-b-2 border-gray-200 dark:border-gray-700 pb-2 w-full">
          {services.map((service) => (
            <Tab
              key={service.id}
              className="px-5 py-3 text-sm md:text-base font-semibold rounded-t-xl border-b-3 border-transparent ui-selected:border-primary ui-selected:text-primary ui-selected:bg-gray-50 dark:ui-selected:bg-gray-800 ui-not-selected:text-muted ui-not-selected:hover:text-default ui-not-selected:hover:bg-gray-50 dark:ui-not-selected:hover:bg-gray-800 dark:ui-selected:text-primary dark:ui-not-selected:text-gray-400 dark:ui-not-selected:hover:text-white transition-all duration-200"
            >
              <span className="mr-2 flex items-center"><Icon name={service.icon} className="w-5 h-5" /></span>
              <span className="hidden sm:inline">{service.name}</span>
              <span className="sm:hidden">{service.name.split(':')[0] || service.name.split(' ')[0]}</span>
            </Tab>
          ))}
            </TabList>
          </div>

          <TabPanels>
          {services.map((service) => (
            <TabPanel key={service.id} className="focus:outline-none animate-fade">
              <div className="max-w-5xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-primary dark:text-primary mr-6 mb-4 sm:mb-0 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Icon name={service.icon} className="w-10 h-10 md:w-12 md:h-12" />
                    </div>
                    <div>
                      <h3 className="text-3xl md:text-4xl font-bold dark:text-white mb-3">{service.name}</h3>
                      <p className="text-lg md:text-xl text-muted dark:text-slate-300 leading-relaxed">{service.description}</p>
                    </div>
                  </div>
                  <div className="pt-6">
                    <h4 className="text-xl md:text-2xl font-semibold dark:text-white mb-6 flex items-center">
                      <span className="w-1 h-8 bg-primary mr-3 rounded-full"></span>
                      Service Details
                    </h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {service.details.map((detail, index) => (
                        <li key={index} className="flex items-start group">
                          <span className="text-primary mr-3 mt-1 text-xl font-bold group-hover:scale-110 transition-transform">✓</span>
                          <span className="text-base md:text-lg text-default dark:text-slate-300 leading-relaxed">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </TabPanel>
          ))}
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  );
}
