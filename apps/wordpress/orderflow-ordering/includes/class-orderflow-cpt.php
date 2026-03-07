<?php
/**
 * Register Custom Post Types for OrderFlow
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class OrderFlow_CPT {

    public function init() {
        add_action( 'init', array( $this, 'register_menu_item_cpt' ) );
        add_action( 'init', array( $this, 'register_menu_category_tsx' ) );
    }

    public function register_menu_item_cpt() {
        $labels = array(
            'name'                  => _x( 'Menu Items', 'Post Type General Name', 'orderflow' ),
            'singular_name'         => _x( 'Menu Item', 'Post Type Singular Name', 'orderflow' ),
            'menu_name'             => __( 'OrderFlow Menu', 'orderflow' ),
            'all_items'             => __( 'All Menu Items', 'orderflow' ),
            'add_new_item'          => __( 'Add New Menu Item', 'orderflow' ),
            'add_new'               => __( 'Add New', 'orderflow' ),
            'new_item'              => __( 'New Menu Item', 'orderflow' ),
            'edit_item'             => __( 'Edit Menu Item', 'orderflow' ),
            'update_item'           => __( 'Update Menu Item', 'orderflow' ),
            'view_item'             => __( 'View Menu Item', 'orderflow' ),
            'view_items'            => __( 'View Menu Items', 'orderflow' ),
            'search_items'          => __( 'Search Menu Items', 'orderflow' ),
            'not_found'             => __( 'Not found', 'orderflow' ),
            'not_found_in_trash'    => __( 'Not found in Trash', 'orderflow' ),
        );
        $args = array(
            'label'                 => __( 'Menu Item', 'orderflow' ),
            'description'           => __( 'Restaurant Menu Items synced from OrderFlow', 'orderflow' ),
            'labels'                => $labels,
            'supports'              => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
            'taxonomies'            => array( 'orderflow_category' ),
            'hierarchical'          => false,
            'public'                => true,
            'show_ui'               => true,
            'show_in_menu'          => true,
            'menu_position'         => 5,
            'menu_icon'             => 'dashicons-food',
            'show_in_admin_bar'     => true,
            'show_in_nav_menus'     => true,
            'can_export'            => true,
            'has_archive'           => true,
            'exclude_from_search'   => false,
            'publicly_queryable'    => true,
            'capability_type'       => 'post',
            'show_in_rest'          => true, // Enable Gutenberg blocks
        );
        register_post_type( 'orderflow_menu_item', $args );
    }

    public function register_menu_category_tsx() {
        $labels = array(
            'name'                       => _x( 'Menu Categories', 'Taxonomy General Name', 'orderflow' ),
            'singular_name'              => _x( 'Menu Category', 'Taxonomy Singular Name', 'orderflow' ),
            'menu_name'                  => __( 'Categories', 'orderflow' ),
            'all_items'                  => __( 'All Categories', 'orderflow' ),
            'new_item_name'              => __( 'New Category Name', 'orderflow' ),
            'add_new_item'               => __( 'Add New Category', 'orderflow' ),
            'edit_item'                  => __( 'Edit Category', 'orderflow' ),
            'update_item'                => __( 'Update Category', 'orderflow' ),
            'view_item'                  => __( 'View Category', 'orderflow' ),
        );
        $args = array(
            'labels'                     => $labels,
            'hierarchical'               => true,
            'public'                     => true,
            'show_ui'                    => true,
            'show_admin_column'          => true,
            'show_in_nav_menus'          => true,
            'show_tagcloud'              => false,
            'show_in_rest'               => true,
        );
        register_taxonomy( 'orderflow_category', array( 'orderflow_menu_item' ), $args );
    }
}
