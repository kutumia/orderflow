import { shopify } from '../shopify';

export interface OFMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
}

/**
 * Synchronizes an OrderFlow menu item to a Shopify Product using GraphQL.
 * We store the OF ID in a metafield so we know which product to update next time.
 */
export async function syncMenuItemToShopify(session: any, menuItem: OFMenuItem) {
  const client = new shopify.api.clients.Graphql({ session });

  const mutation = \`
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  \`;

  const variables = {
    input: {
      title: menuItem.name,
      descriptionHtml: menuItem.description,
      productType: menuItem.category,
      vendor: 'OrderFlow',
      status: 'ACTIVE',
      // We will add the image later via productCreateMedia if exists
      metafields: [
        {
          namespace: 'orderflow',
          key: 'item_id',
          type: 'single_line_text_field',
          value: menuItem.id,
        }
      ],
      variants: [
        {
          price: menuItem.price.toString(),
          requiresShipping: false,
          taxable: true,
        }
      ]
    }
  };

  try {
    const res = await client.request(mutation, { variables });
    console.log(\`[Shopify Sync] Product \${menuItem.name} integrated.\`, res);
    return res;
  } catch (error) {
    console.error('Failed to sync to Shopify:', error);
    throw error;
  }
}
