import {
  render,
  Banner,
  useTranslate,
  useCartLines,
  useApplyCartLinesChange,
  BlockStack,
  Button,
  InlineStack,
  Text,
} from '@shopify/ui-extensions-react/checkout';

// Target the generic block render component
render('purchase.checkout.block.render', () => <App />);

function App() {
  const translate = useTranslate();
  const applyCartLinesChange = useApplyCartLinesChange();
  const lines = useCartLines();

  // Very basic "Rush Order" example native to Shopify Checkout
  const hasRushFee = lines.some((line) => line.merchandise.title === 'Rush Order Fee');

  const addRushFee = async () => {
    // In a real app we would use a specific variant ID tied to the Restaurant's Shopify product
    const RUSH_FEE_VARIANT_ID = 'gid://shopify/ProductVariant/1234567890';
    await applyCartLinesChange({
      type: 'addCartLine',
      merchandiseId: RUSH_FEE_VARIANT_ID,
      quantity: 1,
    });
  };

  return (
    <BlockStack>
      <Banner title="OrderFlow Kitchen Prioritization" status="info">
        {translate('Ensure your order gets to the kitchen first.')}
      </Banner>
      {!hasRushFee ? (
        <InlineStack
          blockAlignment="center"
          inlineAlignment="space-between"
          spacing="base"
        >
          <Text size="base">Add Priority Kitchen Prep (+£3.00)</Text>
          <Button onPress={addRushFee}>Add</Button>
        </InlineStack>
      ) : (
        <Text size="base" appearance="success">
          Priority prep added! Your order will be printed immediately.
        </Text>
      )}
    </BlockStack>
  );
}
