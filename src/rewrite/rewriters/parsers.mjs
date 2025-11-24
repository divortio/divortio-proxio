export function rewriteCSS(css, baseURL, rootDomain) {
    const proxify = (url) => {
        if (!url || url.startsWith('data:') || url.startsWith('chrome-extension:')) return url;
        try {
            const absURL = new URL(url, baseURL);
            if (absURL.hostname.endsWith(`.${rootDomain}`)) return url;
            return `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
        } catch { return url; }
    };
    css = css.replace(/\/\*# sourceMappingURL=.* \*\/$/gm, '');
    css = css.replace(/@import\s*(?:url\(\s*)?['"]?([^'"\)]+)['"]?(?:\s*\))?/gi, (match, url) => match.replace(url, proxify(url)));
    return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => `url(${quote}${proxify(url)}${quote})`);
}

export function rewriteXML(xml, baseURL, rootDomain) {
    const proxiedURL = (url) => `https://${new URL(url, baseURL).hostname}.${rootDomain}${new URL(url, baseURL).pathname}${new URL(url, baseURL).search}`;
    try {
        xml = xml.replace(/<\?xml-stylesheet\s+(.*?)href=["']([^"']+)["'](.*?)\?>/g, (match, pre, url, post) => `<?xml-stylesheet ${pre}href="${proxiedURL(url)}"${post}?>`);
        xml = xml.replace(/<link>([^<]+)<\/link>/g, (match, url) => `<link>${proxiedURL(url)}</link>`);
        xml = xml.replace(/(<enclosure[^>]+url=")([^"]+)(")/g, (match, prefix, url, suffix) => prefix + proxiedURL(url) + suffix);
    } catch (e) {}
    return xml;
}

export function rewriteUrlsInJson(jsonObj, baseURL, rootDomain) {
    for (const key in jsonObj) {
        if (typeof jsonObj[key] === 'string' && (jsonObj[key].startsWith('http:') || jsonObj[key].startsWith('https://'))) {
            try {
                const absURL = new URL(jsonObj[key], baseURL);
                jsonObj[key] = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
            } catch {}
        } else if (typeof jsonObj[key] === 'object' && jsonObj[key] !== null) {
            rewriteUrlsInJson(jsonObj[key], baseURL, rootDomain);
        }
    }
}

export function rewriteLinkHeader(headerValue, baseURL, rootDomain) {
    if (!headerValue) return null;

    return headerValue.split(',').map(part => {
        const relMatch = part.match(/rel\s*=\s*"?([^"]+)"?/);
        if (relMatch && (relMatch[1].includes('preconnect') || relMatch[1].includes('dns-prefetch'))) return '';

        // 1. Fix the main <url>
        let newPart = part.replace(/<([^>]+)>/, (match, url) => {
            try {
                const absURL = new URL(url, baseURL);
                if (absURL.hostname.endsWith('.' + rootDomain)) return match;
                const newUrl = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                return `<${newUrl}>`;
            } catch(e) { return match; }
        });

        // 2. NEW: Fix imagesrcset="..."
        if (newPart.includes('imagesrcset=')) {
            newPart = newPart.replace(/imagesrcset="([^"]+)"/g, (m, srcset) => {
                // Reuse the logic we use for HTML srcset
                const newSrcset = srcset.split(',').map(p => {
                    const [url, desc] = p.trim().split(/\s+/);
                    if (!url) return p;
                    try {
                        const absURL = new URL(url, baseURL);
                        if (absURL.hostname.endsWith('.' + rootDomain)) return p;
                        const proxyUrl = `https://${absURL.hostname}.${rootDomain}${absURL.pathname}${absURL.search}`;
                        return desc ? `${proxyUrl} ${desc}` : proxyUrl;
                    } catch { return p; }
                }).join(', ');
                return `imagesrcset="${newSrcset}"`;
            });
        }

        return newPart;
    })
        .filter(Boolean)
        .join(',');
}