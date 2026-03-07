<?php
/**
 * Native Checkout Integration for WordPress/WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class OrderFlow_Checkout {

    public function init() {
        // Register REST API endpoints for checkout processing
        add_action( 'rest_api_init', array( $this, 'register_checkout_endpoints' ) );
    }

    public function register_checkout_endpoints() {
        register_rest_route( 'orderflow/v1', '/checkout', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'process_checkout' ),
            'permission_callback' => '__return_true', // In production, add nonce/auth checks
        ) );
    }

    /**
     * Handle the native checkout form submission from the React/Vanilla JS frontend
     */
    public function process_checkout( WP_REST_Request $request ) {
        $params = $request->get_json_params();
        
        if ( empty( $params['items'] ) ) {
            return new WP_Error( 'empty_cart', 'Cart is empty', array( 'status' => 400 ) );
        }

        // Calculate total and prepare OrderFlow sync payload
        $total = 0;
        $order_items = array();

        foreach ( $params['items'] as $item ) {
            $post_id = intval( $item['id'] );
            $price = get_post_meta( $post_id, '_orderflow_price', true );
            
            if ( $price ) {
                $total += (float)$price * intval( $item['quantity'] );
                $order_items[] = array(
                    'name'     => get_the_title( $post_id ),
                    'quantity' => intval( $item['quantity'] ),
                    'price'    => (float)$price,
                    // Handle modifiers
                    'modifiers' => isset( $item['modifiers'] ) ? $item['modifiers'] : array()
                );
            }
        }

        $order_payload = array(
            'customerName' => sanitize_text_field( $params['customer_name'] ?? '' ),
            'phone'        => sanitize_text_field( $params['phone'] ?? '' ),
            'items'        => $order_items,
            'total'        => $total,
            'source'       => 'wordpress_native'
        );

        // 1. Send order to OrderFlow Core API/PrintBridge Gateway
        // $response = wp_remote_post( 'https://api.orderflow.co.uk/v1/orders', array(
        //     'body'    => wp_json_encode( $order_payload ),
        //     'headers' => array( 'Content-Type' => 'application/json' )
        // ) );

        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Order placed successfully',
            'order_id' => 'WP-' . time(), // Mock ID
            'total'    => $total
        ) );
    }
}
