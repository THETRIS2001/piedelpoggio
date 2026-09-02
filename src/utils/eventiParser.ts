// Utility functions for parsing event and program filenames

export interface ProgrammaPrecedente {
    anno: number;
    filename: string;
    path: string;
}

export interface DocumentoProloco {
    data: Date;
    dataString: string; // DD-MM-YYYY
    nome: string;
    filename: string;
    path: string;
    ext: string;
}

export function parseProgrammaPrecedente(filename: string, basePath: string): ProgrammaPrecedente | null {
    try {
        // Skip the current program
        if (filename.toLowerCase().includes('corrente')) {
            return null;
        }

        // Remove extension
        const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png)$/i, '');

        // Extract year from "Programma estivo YYYY"
        const match = nameWithoutExt.match(/Programma estivo (\d{4})/i);

        if (!match) {
            console.warn(`Invalid programma filename format: ${filename}`);
            return null;
        }

        const anno = parseInt(match[1], 10);

        return {
            anno,
            filename,
            path: `${basePath}/${encodeURIComponent(filename)}`
        };
    } catch (error) {
        console.error(`Error parsing programma filename: ${filename}`, error);
        return null;
    }
}

/**
 * Sort eventi by date descending (most recent first)
 */
export function sortProgrammiByYear(programmi: ProgrammaPrecedente[]): ProgrammaPrecedente[] {
    return programmi.sort((a, b) => b.anno - a.anno);
}

/**
 * Format date for display badge
 * Example: "07-12-2025" -> "07 DIC 2025"
 */
export function parseDocumentoProloco(filename: string, basePath: string): DocumentoProloco | null {
    try {
        // Skip hidden files
        if (filename.startsWith('.')) {
            return null;
        }

        // Get extension and name without it
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) return null;

        const extension = filename.substring(lastDotIndex + 1).toUpperCase();
        const nameWithoutExt = filename.substring(0, lastDotIndex);

        // Split by " - " (space-dash-space)
        const parts = nameWithoutExt.split(' - ');

        if (parts.length < 2) {
            console.warn(`Invalid documento filename format: ${filename}`);
            return null;
        }

        const [dataString, ...nameParts] = parts;
        const nome = nameParts.join(' - '); // Rejoin in case name contains " - "

        // Parse date DD-MM-YYYY
        const dateParts = dataString.split('-');
        if (dateParts.length !== 3) {
            console.warn(`Invalid date format in filename: ${filename}`);
            return null;
        }

        const [day, month, year] = dateParts.map(Number);
        const data = new Date(year, month - 1, day); // month is 0-indexed

        return {
            data,
            dataString,
            nome: nome.trim(),
            filename,
            path: `${basePath}/${encodeURIComponent(filename)}`,
            ext: extension
        };
    } catch (error) {
        console.error(`Error parsing documento filename: ${filename}`, error);
        return null;
    }
}

/**
 * Sort documenti by date descending (most recent first)
 */
export function sortDocumentiByDate(documenti: DocumentoProloco[]): DocumentoProloco[] {
    return documenti.sort((a, b) => b.data.getTime() - a.data.getTime());
}

export interface Bilancio {
    anno: number;
    filename: string;
    path: string;
}

/**
 * Parse Bilancio filename
 * Format: "Bilancio - YYYY.[jpg|jpeg|png|pdf]"
 * Example: "Bilancio - 2024.jpg"
 */
export function parseBilancio(filename: string, basePath: string): Bilancio | null {
    try {
        // Remove extension
        const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|pdf)$/i, '');

        // Extract year from "Bilancio - YYYY"
        const match = nameWithoutExt.match(/Bilancio - (\d{4})/i);

        if (!match) {
            console.warn(`Invalid bilancio filename format: ${filename}`);
            return null;
        }

        const anno = parseInt(match[1], 10);

        return {
            anno,
            filename,
            path: `${basePath}/${encodeURIComponent(filename)}`
        };
    } catch (error) {
        console.error(`Error parsing bilancio filename: ${filename}`, error);
        return null;
    }
}

/**
 * Sort bilanci by year descending (most recent first)
 */
export function sortBilanciByYear(bilanci: Bilancio[]): Bilancio[] {
    return bilanci.sort((a, b) => b.anno - a.anno);
}
