export interface User {
    id: string;
    name: string;
    email: string;
    companyId?: string;
    companyName?: string;
    companyLogoUrl?: string | null;
}
