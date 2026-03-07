<?php
/**
 * Plugin Name: OrderFlow Online Ordering
 * Plugin URI: https://orderflow.co.uk
 * Description: Native WordPress integration for the OrderFlow Restaurant POS and Online Ordering platform.
 * Version: 2.0.0
 * Author: OrderFlow
 * Author URI: https://orderflow.co.uk
 * Text Domain: orderflow
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'ORDERFLOW_VERSION', '2.0.0' );
define( 'ORDERFLOW_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// Include necessary classes
require_once ORDERFLOW_PLUGIN_DIR . 'includes/class-orderflow-cpt.php';
require_once ORDERFLOW_PLUGIN_DIR . 'includes/class-orderflow-shortcodes.php';

// Initialize the plugin
function orderflow_init() {
    $cpt = new OrderFlow_CPT();
    $cpt->init();

    $shortcodes = new OrderFlow_Shortcodes();
    $shortcodes->init();
}
add_action( 'plugins_loaded', 'orderflow_init' );
