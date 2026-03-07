import Handlebars from 'handlebars';

export interface TemplateData {
  orderId: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
  }>;
  total: number;
  tax: number;
  deliveryFee?: number;
  restaurantName: string;
  address?: string;
  phone?: string;
  date: string;
}

/**
 * Compiles a Handlebars string template into ESC/POS compatible text output.
 * 
 * Future enhancement: Use a JSX-like syntax tree to compile directly to binary ESC/POS buffers
 * (e.g. <Bold><Center>Receipt</Center></Bold>)
 */
export function renderReceiptTemplate(templateStr: string, data: TemplateData): string {
  // Register helpers for receipt formatting
  Handlebars.registerHelper('formatCurrency', function(value) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  });

  // Pad text so prices align to the right edge (assuming 42 chars width typical for 80mm)
  Handlebars.registerHelper('alignRight', function(leftText, rightText, width = 42) {
    const leftStr = String(leftText);
    const rightStr = String(rightText);
    const spaces = Math.max(1, width - leftStr.length - rightStr.length);
    return leftStr + ' '.repeat(spaces) + rightStr;
  });

  const compileTemplate = Handlebars.compile(templateStr);
  return compileTemplate(data);
}

export const DEFAULT_RECEIPT_TEMPLATE = `
{{restaurantName}}
{{#if address}}{{address}}{{/if}}
{{#if phone}}Tel: {{phone}}{{/if}}
------------------------------------------
Order #{{orderId}}
Date: {{date}}
{{#if customerName}}Customer: {{customerName}}{{/if}}
------------------------------------------
{{#each items}}
{{quantity}}x {{name}}
{{#if modifiers}}
{{#each modifiers}}
  - {{this}}
{{/each}}
{{/if}}
{{alignRight '' (formatCurrency price)}}
{{/each}}
------------------------------------------
Subtotal & Tax:           {{formatCurrency tax}}
{{#if deliveryFee}}Delivery Fee:             {{formatCurrency deliveryFee}}{{/if}}
------------------------------------------
TOTAL:                    {{formatCurrency total}}

Thank you for your order!
`;
