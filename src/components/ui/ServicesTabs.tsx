import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

interface Service {
  id: string;
  name: string;
  icon: string;
  description: string;
  details: string[];
}

const services: Service[] = [
  {
    id: 'e-line',
    name: 'E-Line: Logging',
    icon: '📊',
    description: 'Professional logging services using advanced wireline technology for accurate formation evaluation. Real-time data acquisition and expert analysis.',
    details: [
      'Advanced wireline logging technology',
      'Accurate formation evaluation',
      'Real-time data acquisition',
      'Expert analysis and reporting',
      '7-conductor wireline capabilities',
    ],
  },
  {
    id: 'pipe-recovery',
    name: 'Pipe Recovery',
    icon: '🔧',
    description: 'Expert pipe recovery services to retrieve stuck or lost pipe from wellbores. Minimized downtime with specialized tools.',
    details: [
      'Specialized recovery tools',
      'Minimized downtime',
      'Experienced crews',
      'Safe and efficient operations',
      'Proven track record',
    ],
  },
  {
    id: 'perforating',
    name: 'Perforating',
    icon: '🎯',
    description: 'Precision perforating services to optimize well completion and production performance. Safety-focused operations.',
    details: [
      'Precision perforating systems',
      'Optimized well completion',
      'Production performance enhancement',
      'Safety-focused operations',
      'TCP (Tubing Conveyed Perforating) available',
    ],
  },
  {
    id: 'plugs-packers',
    name: 'Setting Plugs & Packers',
    icon: '🔒',
    description: 'Professional setting of plugs and packers for well isolation and completion operations. Reliable sealing solutions.',
    details: [
      'Expert plug and packer setting',
      'Well isolation services',
      'Completion operations',
      'Reliable sealing solutions',
      'Industry-standard equipment',
    ],
  },
  {
    id: 'cameras',
    name: 'Cameras',
    icon: '📷',
    description: 'Downhole camera services for visual inspection and diagnostics. High-resolution imaging for detailed analysis.',
    details: [
      'High-resolution downhole cameras',
      'Visual inspection services',
      'Diagnostic capabilities',
      'Detailed reporting',
      'Real-time video feed',
    ],
  },
  {
    id: 'hepta-line',
    name: '7-Conductor Wireline',
    icon: '⚡',
    description: 'Advanced 7-conductor wireline services for high-performance logging operations. State-of-the-art multi-conductor technology.',
    details: [
      '7-conductor wireline technology',
      'Multi-conductor capabilities',
      'Advanced logging services',
      'High-performance operations',
      'State-of-the-art equipment',
    ],
  },
  {
    id: 'p-a',
    name: 'Plug & Abandonment',
    icon: '🛡️',
    description: 'Safe and compliant plug and abandonment services following industry best practices. Regulatory compliance guaranteed.',
    details: [
      'Regulatory compliance',
      'Safe abandonment procedures',
      'Environmental protection',
      'Expert execution',
      'Full documentation',
    ],
  },
  {
    id: 'hoisting',
    name: 'Third party Hoisting',
    icon: '⬆️',
    description: 'Professional third-party hoisting services for various well operations. Versatile service capabilities.',
    details: [
      'Professional hoisting equipment',
      'Versatile service capabilities',
      'Safe operations',
      'Reliable service delivery',
      'Certified operators',
    ],
  },
  {
    id: 'fishing',
    name: 'Fishing',
    icon: '🎣',
    description: 'Expert fishing services to recover lost or stuck equipment from wellbores. Minimized operational impact.',
    details: [
      'Specialized fishing tools',
      'Expert recovery techniques',
      'Minimized operational impact',
      'Proven track record',
      'Quick response time',
    ],
  },
  {
    id: 'flow-diagnostics',
    name: 'Flow Diagnostics',
    icon: '🌊',
    description: 'Comprehensive flow diagnostics to analyze well performance and production characteristics. Data-driven insights.',
    details: [
      'Flow analysis services',
      'Production diagnostics',
      'Performance evaluation',
      'Data-driven insights',
      'Detailed reporting',
    ],
  },
  {
    id: 'slickline',
    name: 'Slickline',
    icon: '🪢',
    description: 'Efficient slickline services for well intervention, maintenance, and data collection operations. Well intervention expertise.',
    details: [
      'Well intervention services',
      'Maintenance operations',
      'Data collection',
      'Efficient operations',
      '24/7 availability',
    ],
  },
  {
    id: 'swabbing',
    name: 'Swabbing',
    icon: '💧',
    description: 'Expert swabbing services to remove fluids and restore well production efficiently. Experienced crews.',
    details: [
      'Fluid removal services',
      'Production restoration',
      'Efficient operations',
      'Experienced crews',
      'Quick turnaround',
    ],
  },
  {
    id: 'tcp',
    name: 'TCP',
    icon: '💥',
    description: 'Tubing Conveyed Perforating services for efficient well completion. Precision perforating with reliable operations.',
    details: [
      'Tubing conveyed systems',
      'Efficient completion',
      'Precision perforating',
      'Reliable operations',
      'Optimized performance',
    ],
  },
  {
    id: 'kinley-cutter',
    name: 'Kinley Cutter',
    icon: '✂️',
    description: 'Specialized Kinley cutter services for pipe cutting operations. Precision cutting with expert execution.',
    details: [
      'Kinley cutter technology',
      'Precision cutting',
      'Safe operations',
      'Expert execution',
      'Minimal damage',
    ],
  },
  {
    id: 'hydrotesting',
    name: 'Hydrotesting',
    icon: '🔬',
    description: 'Reliable hydrotesting services to ensure equipment integrity and safety compliance. Professional service delivery.',
    details: [
      'Equipment integrity testing',
      'Safety compliance',
      'Reliable results',
      'Professional service',
      'Certified testing',
    ],
  },
  {
    id: 'slick-e-line',
    name: 'Slick E-Line',
    icon: '🔗',
    description: 'Our newest addition: Combined slickline and e-line capabilities for versatile operations. Latest technology with enhanced capabilities.',
    details: [
      'Combined slickline and e-line',
      'Versatile operations',
      'Latest technology',
      'Enhanced capabilities',
      'Innovative solutions',
    ],
  },
];

export default function ServicesTabs() {
  return (
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
        <TabList className="flex flex-wrap justify-center gap-3 mb-12 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
          {services.map((service) => (
            <Tab
              key={service.id}
              className="px-5 py-3 text-sm md:text-base font-semibold rounded-t-xl border-b-3 border-transparent ui-selected:border-primary ui-selected:text-primary ui-selected:bg-gray-50 dark:ui-selected:bg-gray-800 ui-not-selected:text-muted ui-not-selected:hover:text-default ui-not-selected:hover:bg-gray-50 dark:ui-not-selected:hover:bg-gray-800 dark:ui-selected:text-primary dark:ui-not-selected:text-gray-400 dark:ui-not-selected:hover:text-white transition-all duration-200"
            >
              <span className="mr-2 text-lg">{service.icon}</span>
              <span className="hidden sm:inline">{service.name}</span>
              <span className="sm:hidden">{service.name.split(':')[0] || service.name.split(' ')[0]}</span>
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          {services.map((service) => (
            <TabPanel key={service.id} className="focus:outline-none animate-fade">
              <div className="max-w-5xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-5xl md:text-6xl mr-6 mb-4 sm:mb-0">{service.icon}</span>
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
  );
}
