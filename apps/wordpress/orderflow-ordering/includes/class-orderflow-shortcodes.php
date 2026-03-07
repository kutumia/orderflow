<?php
/**
 * Shortcodes and Gutenberg blocks for OrderFlow
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class OrderFlow_Shortcodes {

    public function init() {
        add_shortcode( 'orderflow_menu', array( $this, 'render_orderflow_menu' ) );
    }

    /**
     * Renders the [orderflow_menu] shortcode.
     */
    public function render_orderflow_menu( $atts ) {
        $atts = shortcode_atts( array(
            'category' => '', // specific category slug
            'limit'    => -1, // -1 for all
        ), $atts, 'orderflow_menu' );

        $args = array(
            'post_type'      => 'orderflow_menu_item',
            'posts_per_page' => intval( $atts['limit'] ),
            'post_status'    => 'publish',
            'orderby'        => 'menu_order title',
            'order'          => 'ASC',
        );

        if ( ! empty( $atts['category'] ) ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'orderflow_category',
                    'field'    => 'slug',
                    'terms'    => sanitize_title( $atts['category'] ),
                ),
            );
        }

        $query = new WP_Query( $args );

        ob_start();

        if ( $query->have_posts() ) {
            echo '<div class="orderflow-menu-container">';
            
            while ( $query->have_posts() ) {
                $query->the_post();
                
                $price = get_post_meta( get_the_ID(), '_orderflow_price', true );
                $thumbnail = get_the_post_thumbnail( get_the_ID(), 'medium', array( 'class' => 'orderflow-item-img' ) );
                
                echo '<div class="orderflow-menu-item">';
                if ( $thumbnail ) {
                    echo $thumbnail;
                }
                echo '<div class="orderflow-item-content">';
                echo '<h3 class="orderflow-item-title">' . get_the_title() . '</h3>';
                echo '<p class="orderflow-item-desc">' . get_the_excerpt() . '</p>';
                if ( $price ) {
                    echo '<span class="orderflow-item-price">£' . esc_html( number_format( (float)$price, 2 ) ) . '</span>';
                }
                
                // Add to Cart Button (Native WooCommerce or OrderFlow Cart)
                echo '<button class="orderflow-add-to-cart" data-id="' . get_the_ID() . '">' . __( 'Add to Order', 'orderflow' ) . '</button>';
                
                echo '</div>'; // .orderflow-item-content
                echo '</div>'; // .orderflow-menu-item
            }
            
            echo '</div>'; // .orderflow-menu-container
            wp_reset_postdata();
        } else {
            echo '<p>' . __( 'No menu items found.', 'orderflow' ) . '</p>';
        }

        return ob_get_clean();
    }
}
