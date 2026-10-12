export interface Experience {
  role: string;
  org: string;
  period: string;
  bullets: string[];
}

export interface SkillLogo {
  name: string;
  alt: string;
  image?: string;
  icon?: string;
}

export const profile = {
  name: 'Alamsyah Hanza',
  headline: 'Data Scientist and BI Engineer, 10+ years in retail and logistics',
  valueStatement: 'I use data to cut costs and speed up delivery in retail and logistics.',
  summary:
    "I'm a data scientist who turns messy data into decisions a business can act on. I've worked at Amazon, Gojek and Roms, building models and reports that lower costs and improve key numbers. I also lead teams and run a data science community.",
  metaDescription:
    "Data scientist and BI engineer with 10+ years in retail and logistics. I turn messy data into decisions that cut costs, and I lead teams and a data science community.",
  atAGlance: [
    { label: 'Experience', value: '10+ years' },
    { label: 'Industries', value: 'Retail, logistics, supply chain' },
    {
      label: 'Strengths',
      value: 'Machine learning, data analysis, experiment (A/B) testing, dashboards and reporting',
    },
    { label: 'Now', value: 'Business Intelligence Engineer, Amazon (since April 2025)' },
    { label: 'Education', value: "Bachelor's in Mathematics, Universitas Indonesia" },
    { label: 'Languages', value: 'Indonesian (native), English (intermediate)' },
  ],
  achievements: [
    'Cut logistics costs by 15% at Gojek with a machine-learning model.',
    'Saved about 15% in costs and cut packing time by 10% at Roms with a packing optimization.',
    'Predicted food delivery times for 500,000+ restaurants.',
    'Delivered 20+ dashboards in 2 months for a client (Indonesia Re).',
    'Led a 25+ person committee running a 3,000+ member data science community.',
  ],
  experience: [
    {
      role: 'Business Intelligence Engineer',
      org: 'Amazon',
      period: 'Apr 2025 - Present',
      bullets: [
        'Plan where inventory is stored for faster same-day delivery.',
        'Build self-serve tools and automated KPI reports for Supply Chain leaders.',
      ],
    },
    {
      role: 'Data Scientist',
      org: 'Roms, inc.',
      period: 'Feb 2024 - Apr 2025',
      bullets: ['Built tools to pack and categorize items more efficiently and forecast stock levels.'],
    },
    {
      role: 'Data Scientist',
      org: 'Gojek Indonesia',
      period: 'Mar 2019 - Apr 2024',
      bullets: [
        'Led data science and BI teams.',
        'Built models for delivery times, fraud detection and demand, and ran A/B tests with product managers.',
      ],
    },
    {
      role: 'Data Consultant (part-time)',
      org: 'Indonesia Re',
      period: 'Oct 2022 - Apr 2023',
      bullets: ['Brought scattered data together and delivered 20+ dashboards with handover documentation.'],
    },
    {
      role: 'Business Intelligence Analyst',
      org: 'Gojek Indonesia',
      period: 'Oct 2017 - Mar 2019',
      bullets: ['Analyzed products, automated reports and built customer segments.'],
    },
  ] satisfies Experience[],
  skillGroups: [
    {
      title: 'Analysis and ML',
      text: 'Python (advanced), SQL (expert), machine learning, experiment design, pandas, Jupyter',
    },
    { title: 'Data and cloud', text: 'ETL, Google Cloud, AWS, Docker, GitHub' },
    { title: 'BI and visualization', text: 'Tableau, Google Data Studio, Amazon QuickSight' },
    { title: 'People', text: 'Stakeholder management, training and mentoring, project management' },
  ],
  education: {
    degree: "Bachelor's in Mathematics",
    school: 'Universitas Indonesia',
    detail: '2011 - 2014, GPA 3.72',
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
