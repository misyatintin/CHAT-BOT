const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

class LinkScraper {
    constructor() {
        this.timeout = 10000; // 10 seconds timeout
        this.maxContentLength = 50000; // 50KB max content
        
        // Create HTTPS agent with SSL configuration
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Allow self-signed certificates
            secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT, // Enable legacy renegotiation
            ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:DES-CBC3-SHA',
            honorCipherOrder: true,
            secureProtocol: 'TLSv1_2_method'
        });
    }

    async scrapeContent(url) {
        try {
            // Validate URL
            this.validateUrl(url);

            // Fetch the webpage with SSL configuration
            const response = await axios.get(url, {
                timeout: this.timeout,
                httpsAgent: this.httpsAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Accept redirects
                }
            });

            // Parse HTML content
            const $ = cheerio.load(response.data);
            
            // Remove unwanted elements
            $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar, .menu, .navigation').remove();
            
            // Extract title
            const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
            
            // Extract main content
            let content = '';
            
            // Try to find main content areas
            const contentSelectors = [
                'main',
                '[role="main"]',
                '.main-content',
                '.content',
                'article',
                '.post-content',
                '.entry-content',
                '#content',
                '.page-content',
                '.article-body'
            ];
            
            let mainContent = null;
            for (const selector of contentSelectors) {
                if ($(selector).length > 0) {
                    mainContent = $(selector).first();
                    break;
                }
            }
            
            if (mainContent && mainContent.text().trim().length > 0) {
                content = mainContent.text();
            } else {
                // Fallback: get all paragraph and heading text
                const paragraphs = $('p, h1, h2, h3, h4, h5, h6').map((i, el) => $(el).text().trim()).get();
                content = paragraphs.filter(text => text.length > 10).join('\n\n');
            }
            
            // Clean up content
            content = this.cleanText(content);
            
            // Check if we have meaningful content
            if (!content || content.trim().length < 50) {
                throw new Error('Insufficient content extracted from the webpage');
            }
            
            // Limit content length
            if (content.length > this.maxContentLength) {
                content = content.substring(0, this.maxContentLength) + '...';
            }
            
            return {
                title: title,
                content: content,
                url: url,
                scrapedAt: new Date().toISOString(),
                contentLength: content.length
            };
            
        } catch (error) {
            console.error('Link scraping error:', error);
            
            // Provide more specific error messages
            if (error.code === 'EPROTO') {
                throw new Error(`SSL/TLS connection failed for ${url}. The website may have SSL configuration issues.`);
            } else if (error.code === 'ENOTFOUND') {
                throw new Error(`Website not found: ${url}`);
            } else if (error.code === 'ECONNREFUSED') {
                throw new Error(`Connection refused by ${url}`);
            } else if (error.code === 'ETIMEDOUT') {
                throw new Error(`Request timeout for ${url}`);
            } else if (error.response && error.response.status) {
                throw new Error(`HTTP ${error.response.status} error for ${url}`);
            } else {
                throw new Error(`Failed to scrape content from ${url}: ${error.message}`);
            }
        }
    }

    validateUrl(url) {
        try {
            const urlObject = new URL(url);
            
            // Check if protocol is http or https
            if (!['http:', 'https:'].includes(urlObject.protocol)) {
                throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
            }
            
            // Block certain domains if needed
            const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
            if (blockedDomains.some(domain => urlObject.hostname.includes(domain))) {
                throw new Error('Cannot scrape local URLs for security reasons.');
            }
            
            // Check for valid hostname
            if (!urlObject.hostname || urlObject.hostname.length < 3) {
                throw new Error('Invalid hostname in URL.');
            }
            
            return true;
        } catch (error) {
            if (error.message.includes('Invalid URL')) {
                throw new Error('Invalid URL format. Please provide a valid HTTP or HTTPS URL.');
            }
            throw error;
        }
    }

    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
            .replace(/[\r\n\t]+/g, ' ') // Replace tabs and newlines with spaces
            .replace(/[^\w\s\.\,\!\?\-\(\)\:\;\"\'\[\]]/g, '') // Remove special characters except basic punctuation
            .replace(/\s+([\.!\?])/g, '$1') // Remove spaces before punctuation
            .trim();
    }

    async getMetadata(url) {
        try {
            const response = await axios.get(url, {
                timeout: this.timeout,
                httpsAgent: this.httpsAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5
            });

            const $ = cheerio.load(response.data);
            
            return {
                title: $('title').text().trim() || '',
                description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
                keywords: $('meta[name="keywords"]').attr('content') || '',
                author: $('meta[name="author"]').attr('content') || '',
                ogTitle: $('meta[property="og:title"]').attr('content') || '',
                ogDescription: $('meta[property="og:description"]').attr('content') || '',
                ogImage: $('meta[property="og:image"]').attr('content') || '',
                canonical: $('link[rel="canonical"]').attr('href') || url,
                language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || 'en'
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            // Return basic metadata instead of null
            return {
                title: '',
                description: '',
                keywords: '',
                author: '',
                ogTitle: '',
                ogDescription: '',
                ogImage: '',
                canonical: url,
                language: 'en'
            };
        }
    }
}

module.exports = LinkScraper;