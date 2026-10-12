export interface Experience {
  role: string;
  org: string;
  country: string;
  period: string;
  start: string;
  end?: string;
  bullets: string[];
}

export interface TitledText {
  title: string;
  text: string;
}

export interface SkillLogo {
  name: string;
  alt: string;
  image?: string;
  icon?: string;
}

const location = { current: 'Tokyo, Japan' };
const based = location.current;

export const profile = {
  name: 'Alamsyah Hanza',
  location,
  headline: 'Data Scientist and BI Engineer, 10+ years in retail and logistics',
  valueStatement: 'Optimization through data: cutting costs and speeding up delivery in retail and logistics.',
  summary:
    "My work is optimization through data: turning messy data into decisions a business can act on. I've worked at Amazon, Gojek and Roms, building models and reports that lower costs and improve key numbers. I also lead teams and run a data science community.",
  metaDescription:
    "Data scientist and BI engineer with 10+ years in retail and logistics. Optimization through data: modeling, statistics, pipelines and dashboards that cut costs and speed up delivery.",
  atAGlance: [
    { label: 'Experience', value: '10+ years' },
    { label: 'Industries', value: 'Retail, logistics, supply chain' },
    {
      label: 'Strengths',
      value: 'Optimization, data modeling, statistics (A/B testing), ETL / data pipelines, dashboarding, data analysis & exploration',
    },
    { label: 'Now', value: 'Business Intelligence Engineer, Amazon (since April 2025)' },
    { label: 'Based', value: based },
    { label: 'Education', value: "Bachelor's in Mathematics, Universitas Indonesia" },
    { label: 'Languages', value: 'Indonesian (native), English (intermediate)' },
  ],
  json: {
    now: 'Business Intelligence Engineer, Amazon',
    based,
    industries: 'Retail, logistics, supply chain',
    strengths: 'Optimization, data modeling, statistics (A/B testing), ETL / data pipelines, dashboarding, data analysis & exploration',
    also: 'Leads teams and runs a data science community',
  },
  focus: [
    { title: 'Optimizing stock placement', text: 'Deciding where inventory sits for faster same-day delivery.' },
    { title: 'Cutting operating costs', text: 'Logistics and packing optimization with machine learning.' },
    { title: 'Modeling what happens next', text: 'Delivery times, demand, stock levels and suspicious activity.' },
    { title: 'Testing what works', text: 'Designing and reading A/B tests with product managers.' },
    { title: 'Pipelines and dashboards', text: 'Scattered data brought together into self-serve tools and KPI reports.' },
    { title: 'Analysis and exploration', text: 'Digging into products and customer segments to find what is worth acting on.' },
  ] satisfies TitledText[],
  problems: [
    { title: 'Faster delivery', text: 'Optimizing where inventory is stored and predicting delivery times.' },
    { title: 'Lower operating costs', text: 'Logistics and packing optimization with machine learning.' },
    { title: 'Forecasting and fraud', text: 'Models for demand, stock levels and delivery times, and for flagging suspicious activity.' },
    { title: 'Experiments', text: 'Designing and reading A/B tests with product managers.' },
    { title: 'Messy data to pipelines', text: 'Bringing scattered data together with ETL, so teams work from one source.' },
    { title: 'Dashboards that get used', text: 'Self-serve tools and KPI reports for leaders.' },
    { title: 'Analysis and exploration', text: 'Analyzing products and building customer segments to see what is worth acting on.' },
    { title: 'Teams and community', text: 'Leading data science and BI teams, and running a data science community.' },
  ] satisfies TitledText[],
  cvNote: 'roles, projects and results, in one PDF',
  experience: [
    {
      role: 'Business Intelligence Engineer',
      org: 'Amazon',
      country: 'Japan',
      period: 'Apr 2025 - Present',
      start: '2025-04',
      bullets: [
        'Plan where inventory is stored for faster same-day delivery.',
        'Build self-serve tools and automated KPI reports for Supply Chain leaders.',
      ],
    },
    {
      role: 'Data Scientist',
      org: 'Roms, inc.',
      country: 'Japan',
      period: 'Feb 2024 - Apr 2025',
      start: '2024-02',
      end: '2025-04',
      bullets: ['Built tools to pack and categorize items more efficiently and forecast stock levels.'],
    },
    {
      role: 'Data Scientist',
      org: 'Gojek Indonesia',
      country: 'Indonesia',
      period: 'Mar 2019 - Apr 2024',
      start: '2019-03',
      end: '2024-04',
      bullets: [
        'Led data science and BI teams.',
        'Built models for delivery times, fraud detection and demand, and ran A/B tests with product managers.',
      ],
    },
    {
      role: 'Data Consultant (part-time)',
      org: 'Indonesia Re',
      country: 'Indonesia',
      period: 'Oct 2022 - Apr 2023',
      start: '2022-10',
      end: '2023-04',
      bullets: ['Brought scattered data together and delivered dashboards with handover documentation.'],
    },
    {
      role: 'Business Intelligence Analyst',
      org: 'Gojek Indonesia',
      country: 'Indonesia',
      period: 'Oct 2017 - Mar 2019',
      start: '2017-10',
      end: '2019-03',
      bullets: ['Analyzed products, automated reports and built customer segments.'],
    },
  ] satisfies Experience[],
  skillGroups: [
    { title: 'optimization', items: ['inventory placement', 'logistics and packing', 'forecasting', 'machine learning'] },
    { title: 'modelling + stats', items: ['Python (advanced)', 'machine learning', 'experiment design', 'pandas', 'Jupyter'] },
    { title: 'data engineering', items: ['SQL (expert)', 'ETL', 'Google Cloud', 'AWS', 'Docker', 'GitHub'] },
    { title: 'bi + dashboards', items: ['Tableau', 'Google Data Studio', 'Amazon QuickSight'] },
    { title: 'analysis', items: ['data analysis', 'data exploration', 'customer segments'] },
    { title: 'people', items: ['stakeholder management', 'training and mentoring', 'project management'] },
  ],
  education: {
    degree: "Bachelor's in Mathematics",
    school: 'Universitas Indonesia',
    detail: '2011 - 2014',
  },
  certificates: [
    'Intro to TensorFlow for AI, ML and Deep Learning (2020)',
    'Critical Thinking for the Information Age (2020)',
    'Pattern Discovery in Data Mining (2019)',
  ],
  closing: "Happy to chat about data, analytics or the community. Grab a slot or say hi on LinkedIn.",
  skillLogos: [
    { name: 'Jupyter', alt: 'Jupyter logo', image: '/images/jupyter-svgrepo-com.svg' },
    { name: 'Docker', alt: 'Docker logo', image: '/images/docker-icon-svgrepo-com.svg' },
    { name: 'pandas', alt: 'pandas logo', image: '/images/Pandas_mark.svg' },
    { name: 'Python', alt: 'Python logo', image: '/images/python-svgrepo-com.svg' },
    { name: 'Tableau', alt: 'Tableau logo', image: '/images/tableau-icon-svgrepo-com.svg' },
    { name: 'Google Cloud', alt: 'Google Cloud logo', image: '/images/google-cloud-svgrepo-com.svg' },
    { name: 'GitHub', alt: 'GitHub logo', icon: 'brand-github' },
    { name: 'AWS', alt: 'AWS logo', icon: 'brand-aws' },
    { name: 'Amazon QuickSight', alt: 'Amazon QuickSight logo', icon: 'chart-bar' },
  ] satisfies SkillLogo[],
};
