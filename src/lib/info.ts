import rawServices from "../data/services.json";
import rawUses from "../data/uses.json";
import rawSiteInfo from "../../public/0user.json";

export interface ContactLink {
    label: string;
    text: string;
    href: string;
    target?: string;
    rel?: string;
}

export interface DownloadItem {
    label: string;
    text: string;
    href: string;
    filename?: string;
}

export interface ExperienceItem {
    role: string;
    company?: string;
    location?: string;
    period: string;
    description: string[];
}

export interface EducationItem {
    degree: string;
    institution: string;
    period: string;
    details?: string[];
}

export interface SkillCategory {
    category: string;
    items: string[];
}

export interface PresenceConfig {
    userId: string;
    endpoint?: string;
}

export interface UseItem {
    name: string;
    icon?: string;
    description?: string;
}

export interface UseCategory {
    category: string;
    items: UseItem[];
}

export interface ServiceEntry {
    id: string;
    icon?: string;
    name?: string;
    instructions?: string;
    requestAccess?: boolean;
}

export interface ResumeData {
    name: string;
    role: string;
    bio: string;
    downloads: {
        cv: DownloadItem;
        pgp: DownloadItem;
    };
    pgpFingerprint?: string;
    experience: ExperienceItem[];
    skills: SkillCategory[];
    education?: EducationItem[];
    certifications?: string[];
}

export interface SiteMeta {
    name: string;
    url: string;
    title: string;
    description: string;
    locale?: string;
    ogImage?: string;
}

export interface SiteInfo {
    name: string;
    role: string;
    site: SiteMeta;
    contacts: ContactLink[];
    presence?: PresenceConfig;
    resume: ResumeData;
}

export const info: SiteInfo = rawSiteInfo as SiteInfo;

export const contacts = info.contacts;
export const resume = info.resume;
export const uses = rawUses as UseCategory[];
export const services = rawServices as ServiceEntry[];

export default info;