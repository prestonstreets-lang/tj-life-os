const cleanTokens = value => [...new Set(String(value || '').toLowerCase().match(/[a-z0-9+#.]{2,}/g) || [])];

export function scoreJob(job, profile) {
  const desired = cleanTokens(`${profile.targetRoles || ''} ${profile.skills || ''}`);
  const haystack = new Set(cleanTokens(`${job.title || ''} ${job.company || ''} ${job.description || ''}`));
  const matched = desired.filter(token => haystack.has(token));
  const roleTokens = cleanTokens(profile.targetRoles);
  const titleTokens = new Set(cleanTokens(job.title));
  const roleMatches = roleTokens.filter(token => titleTokens.has(token)).length;
  const location = String(profile.location || '').toLowerCase();
  const jobLocation = String(job.location || '').toLowerCase();
  const mode = String(profile.workMode || 'any').toLowerCase();
  const jobMode = String(job.workMode || '').toLowerCase();
  const skillScore = desired.length ? (matched.length / desired.length) * 48 : 18;
  const roleScore = roleTokens.length ? (roleMatches / roleTokens.length) * 28 : 12;
  const locationScore = !location || jobMode === 'remote' || jobLocation.includes(location) ? 14 : 0;
  const modeScore = mode === 'any' || !jobMode || jobMode === mode ? 6 : 0;
  const salaryScore = !profile.salaryMin || Number(job.salaryMax || job.salaryMin || 0) >= Number(profile.salaryMin) ? 4 : 0;
  return { score: Math.min(100, Math.round(skillScore + roleScore + locationScore + modeScore + salaryScore)), matched };
}

export function buildJobSearchLinks(profile) {
  const role = String(profile.targetRoles || '').split(',')[0].trim() || 'jobs';
  const location = String(profile.location || '').trim();
  const query = encodeURIComponent(role);
  const place = encodeURIComponent(location);
  const combined = encodeURIComponent(`${role} jobs ${location ? `near ${location}` : ''}`.trim());
  return [
    { id: 'google', label: 'Google Jobs', detail: 'Broad local discovery', url: `https://www.google.com/search?q=${combined}` },
    { id: 'indeed', label: 'Indeed', detail: 'High-volume local listings', url: `https://www.indeed.com/jobs?q=${query}&l=${place}` },
    { id: 'linkedin', label: 'LinkedIn', detail: 'Network-aware opportunities', url: `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${place}` },
    { id: 'usajobs', label: 'USAJOBS', detail: 'Federal roles and public service', url: `https://www.usajobs.gov/Search/Results?k=${query}&l=${place}` }
  ];
}

export function buildResumePrompt({ resume, jobDescription, jobTitle = '', company = '' }) {
  return `Act as an expert resume strategist and ATS editor. Tailor the resume below for the ${jobTitle || 'target'} role${company ? ` at ${company}` : ''}.

Rules:
- Never invent experience, credentials, employers, dates, metrics, or tools.
- Preserve truthful facts while matching the job's language naturally.
- Prioritize the most relevant skills and measurable accomplishments.
- Identify missing keywords separately instead of fabricating them.
- Use concise, achievement-focused bullets and an ATS-safe structure.

Return:
1. A tailored professional summary.
2. A rewritten skills section.
3. Revised experience bullets, grouped under the original employers.
4. A keyword-gap list.
5. Three truthful talking points for a cover letter or interview.

CURRENT RESUME:
${String(resume || '').trim() || '[Paste the current resume here]'}

JOB DESCRIPTION:
${String(jobDescription || '').trim() || '[Paste the job description here]'}`;
}
