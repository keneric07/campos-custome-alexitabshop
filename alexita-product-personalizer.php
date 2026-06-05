<?php
/**
 * Plugin Name: Alexita Product Personalizer
 * Plugin URI: https://alexitabshop.com/
 * Description: Personalización gratuita para WooCommerce: genera nombre, número y foto por cada unidad comprada.
 * Version: 1.2.6
 * Author: HW STUDIO | Software Labs
 * Text Domain: alexita-product-personalizer
 * Requires Plugins: woocommerce
 * Requires PHP: 7.4
 * WC requires at least: 7.0
 * WC tested up to: 9.9
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Alexita_Product_Personalizer {

	const VERSION = '1.2.6';
	const META_ENABLED = '_alexita_personalizer_enabled';
	const NONCE_ACTION = 'alexita_personalizer_add_to_cart';
	const NONCE_NAME = 'alexita_personalizer_nonce';
	const UPLOAD_NONCE_ACTION = 'alexita_personalizer_upload_photo';
	const UPLOAD_NONCE_NAME = 'alexita_upload_nonce';
	const MAX_FILE_SIZE = 2621440; // 2.5 MB en bytes.

	private static $prepared_personalization = array();

	public static function init() {
		add_action( 'plugins_loaded', array( __CLASS__, 'load' ) );
	}

	public static function load() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( __CLASS__, 'woocommerce_missing_notice' ) );
			return;
		}

		if ( did_action( 'before_woocommerce_init' ) ) {
			self::declare_compatibility();
		} else {
			add_action( 'before_woocommerce_init', array( __CLASS__, 'declare_compatibility' ) );
		}

		// Admin: activar/desactivar por producto.
		add_action( 'woocommerce_product_options_general_product_data', array( __CLASS__, 'add_product_option' ) );
		add_action( 'woocommerce_process_product_meta', array( __CLASS__, 'save_product_option' ) );

		// Frontend.
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_filter( 'woocommerce_add_to_cart_form_action', array( __CLASS__, 'add_to_cart_form_action' ) );
		add_action( 'woocommerce_before_add_to_cart_button', array( __CLASS__, 'render_fields' ) );
		add_filter( 'woocommerce_loop_add_to_cart_link', array( __CLASS__, 'replace_loop_add_to_cart' ), 10, 3 );

		// Carrito y pedido.
		add_filter( 'woocommerce_add_to_cart_validation', array( __CLASS__, 'validate_and_prepare_personalization' ), 10, 6 );
		add_filter( 'woocommerce_add_cart_item_data', array( __CLASS__, 'add_cart_item_data' ), 10, 4 );
		add_filter( 'woocommerce_get_item_data', array( __CLASS__, 'display_cart_item_data' ), 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( __CLASS__, 'save_order_item_meta' ), 10, 4 );

		// Evita que cambien la cantidad después de personalizar.
		add_filter( 'woocommerce_update_cart_validation', array( __CLASS__, 'prevent_cart_quantity_change' ), 10, 4 );
		add_filter( 'woocommerce_cart_item_quantity', array( __CLASS__, 'lock_cart_quantity_input' ), 10, 3 );

		// Subida anticipada de fotos (móvil / evita $_FILES en add to cart).
		add_action( 'wp_ajax_alexita_upload_player_photo', array( __CLASS__, 'ajax_upload_player_photo' ) );
		add_action( 'wp_ajax_nopriv_alexita_upload_player_photo', array( __CLASS__, 'ajax_upload_player_photo' ) );
	}

	public static function declare_compatibility() {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}

	public static function woocommerce_missing_notice() {
		if ( current_user_can( 'activate_plugins' ) ) {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html__( 'Alexita Product Personalizer necesita WooCommerce activo para funcionar.', 'alexita-product-personalizer' )
			);
		}
	}

	public static function plugin_url( $path = '' ) {
		return plugin_dir_url( __FILE__ ) . ltrim( $path, '/' );
	}

	/**
	 * @param mixed $product Producto WooCommerce u otro valor.
	 */
	private static function is_wc_product( $product ) {
		return is_object( $product ) && is_a( $product, 'WC_Product' );
	}

	/**
	 * Longitud de cadena multibyte sin depender de mbstring.
	 *
	 * @param string $string Texto.
	 */
	private static function str_length( $string ) {
		$string = (string) $string;

		if ( function_exists( 'mb_strlen' ) ) {
			return (int) mb_strlen( $string );
		}

		if ( function_exists( 'iconv_strlen' ) ) {
			$length = @iconv_strlen( $string, 'UTF-8' ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			if ( false !== $length ) {
				return (int) $length;
			}
		}

		if ( preg_match_all( '/./u', $string, $matches ) ) {
			return count( $matches[0] );
		}

		return strlen( $string );
	}

	/**
	 * Convierte un codepoint Unicode a UTF-8 sin depender de mb_chr.
	 *
	 * @param int $codepoint Codepoint Unicode.
	 */
	private static function unicode_to_utf8( $codepoint ) {
		$codepoint = (int) $codepoint;

		if ( $codepoint <= 0 ) {
			return '';
		}

		if ( function_exists( 'mb_chr' ) ) {
			return (string) mb_chr( $codepoint, 'UTF-8' );
		}

		if ( $codepoint <= 0x7F ) {
			return chr( $codepoint );
		}

		if ( $codepoint <= 0x7FF ) {
			return chr( 0xC0 | ( $codepoint >> 6 ) ) . chr( 0x80 | ( $codepoint & 0x3F ) );
		}

		if ( $codepoint <= 0xFFFF ) {
			return chr( 0xE0 | ( $codepoint >> 12 ) )
				. chr( 0x80 | ( ( $codepoint >> 6 ) & 0x3F ) )
				. chr( 0x80 | ( $codepoint & 0x3F ) );
		}

		if ( $codepoint <= 0x10FFFF ) {
			return chr( 0xF0 | ( $codepoint >> 18 ) )
				. chr( 0x80 | ( ( $codepoint >> 12 ) & 0x3F ) )
				. chr( 0x80 | ( ( $codepoint >> 6 ) & 0x3F ) )
				. chr( 0x80 | ( $codepoint & 0x3F ) );
		}

		return '';
	}

	/**
	 * Normaliza texto para JSON / JS (UTF-8 válido).
	 *
	 * @param string $value Texto.
	 */
	private static function sanitize_utf8( $value ) {
		$value = (string) $value;

		if ( function_exists( 'wp_check_invalid_utf8' ) ) {
			return wp_check_invalid_utf8( $value, true );
		}

		if ( function_exists( 'mb_convert_encoding' ) ) {
			return (string) mb_convert_encoding( $value, 'UTF-8', 'UTF-8' );
		}

		return $value;
	}

	/**
	 * @return array<int, array{code: string, name: string, iso?: string, flag?: string, host?: bool}>
	 */
	private static function get_countries_list() {
		static $countries = null;

		if ( null !== $countries ) {
			return $countries;
		}

		$countries = array();
		$file      = __DIR__ . '/includes/countries.php';

		if ( is_readable( $file ) ) {
			$loaded = include $file;
			if ( is_array( $loaded ) ) {
				$countries = $loaded;
			}
		}

		return $countries;
	}

	private static function iso_to_flag( $iso ) {
		$iso = strtoupper( preg_replace( '/[^A-Z]/', '', (string) $iso ) );

		if ( strlen( $iso ) !== 2 ) {
			return '';
		}

		$flag = '';

		for ( $i = 0; $i < 2; $i++ ) {
			$flag .= self::unicode_to_utf8( ord( $iso[ $i ] ) + 127397 );
		}

		return self::sanitize_utf8( $flag );
	}

	/**
	 * @return array<int, array{code: string, name: string, flag: string, host: bool}>
	 */
	private static function get_countries_for_js() {
		$list = array();

		foreach ( self::get_countries_list() as $country ) {
			if ( ! is_array( $country ) ) {
				continue;
			}

			$code = isset( $country['code'] ) ? self::sanitize_utf8( (string) $country['code'] ) : '';
			$name = isset( $country['name'] ) ? self::sanitize_utf8( (string) $country['name'] ) : '';

			if ( '' === $code || '' === $name ) {
				continue;
			}

			$flag = '';

			if ( ! empty( $country['flag'] ) ) {
				$flag = self::sanitize_utf8( (string) $country['flag'] );
			} elseif ( ! empty( $country['iso'] ) ) {
				$flag = self::iso_to_flag( $country['iso'] );
			}

			$list[] = array(
				'code' => strtoupper( $code ),
				'name' => $name,
				'flag' => $flag,
				'host' => ! empty( $country['host'] ),
			);
		}

		return $list;
	}

	/**
	 * @return array{code: string, name: string, flag: string}|null
	 */
	private static function get_country_by_code( $code ) {
		$code = strtoupper( sanitize_text_field( (string) $code ) );

		if ( '' === $code ) {
			return null;
		}

		foreach ( self::get_countries_for_js() as $country ) {
			if ( $country['code'] === $code ) {
				return $country;
			}
		}

		return null;
	}

	public static function add_product_option() {
		woocommerce_wp_checkbox(
			array(
				'id'          => self::META_ENABLED,
				'label'       => __( 'Personalización Alexita', 'alexita-product-personalizer' ),
				'description' => __( 'Activa campos por cantidad: nombre, número y foto del rostro por cada unidad comprada.', 'alexita-product-personalizer' ),
				'desc_tip'    => true,
			)
		);
	}

	public static function save_product_option( $post_id ) {
		$value = isset( $_POST[ self::META_ENABLED ] ) ? 'yes' : 'no'; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		update_post_meta( $post_id, self::META_ENABLED, $value );
	}

	private static function is_enabled_product( $product_id ) {
		$product_id = absint( $product_id );

		if ( ! $product_id || ! function_exists( 'wc_get_product' ) ) {
			return false;
		}

		$product = wc_get_product( $product_id );

		if ( ! self::is_wc_product( $product ) ) {
			return false;
		}

		$parent_id = $product->get_parent_id();
		$check_id  = $parent_id ? $parent_id : $product_id;

		return 'yes' === get_post_meta( $check_id, self::META_ENABLED, true );
	}

	public static function add_to_cart_form_action( $action ) {
		global $product;

		if ( ! self::is_wc_product( $product ) || ! function_exists( 'is_product' ) || ! is_product() ) {
			return $action;
		}

		if ( self::is_enabled_product( $product->get_id() ) ) {
			return get_permalink( $product->get_id() );
		}

		return $action;
	}

	public static function enqueue_assets() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		$product_id = get_queried_object_id();

		if ( ! $product_id || ! self::is_enabled_product( $product_id ) ) {
			return;
		}

		$countries = array();

		try {
			$countries = self::get_countries_for_js();
		} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
			$countries = array();
		}

		if ( ! is_array( $countries ) ) {
			$countries = array();
		}

		wp_enqueue_style(
			'alexita-product-personalizer',
			self::plugin_url( 'assets/css/frontend.css' ),
			array(),
			self::VERSION
		);

		wp_enqueue_script(
			'alexita-product-personalizer',
			self::plugin_url( 'assets/js/frontend.js' ),
			array(),
			self::VERSION,
			true
		);

		wp_localize_script(
			'alexita-product-personalizer',
			'AlexitaPersonalizer',
			array(
				'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
				'uploadNonce'     => wp_create_nonce( self::UPLOAD_NONCE_ACTION ),
				'uploadAction'    => 'alexita_upload_player_photo',
				'maxFileSize'     => self::MAX_FILE_SIZE,
				'maxFileSizeText' => '2.5 MB',
				'countries'       => $countries,
				'labels'          => array(
					'player'          => __( 'Unidad', 'alexita-product-personalizer' ),
					'name'            => __( 'Nombre', 'alexita-product-personalizer' ),
					'number'          => __( 'Número', 'alexita-product-personalizer' ),
					'country'         => __( 'País', 'alexita-product-personalizer' ),
					'countryChoose'   => __( 'Selecciona tu país', 'alexita-product-personalizer' ),
					'countrySearch'   => __( 'Buscar país…', 'alexita-product-personalizer' ),
					'countryModalTitle' => __( 'Elige tu país', 'alexita-product-personalizer' ),
					'countryCancel'   => __( 'Cancelar', 'alexita-product-personalizer' ),
					'countryNoResults' => __( 'Ningún país coincide', 'alexita-product-personalizer' ),
					'countryHosts'    => __( 'Anfitriones', 'alexita-product-personalizer' ),
					'countryAll'      => __( 'Todos los países', 'alexita-product-personalizer' ),
					'photo'           => __( 'Foto del rostro', 'alexita-product-personalizer' ),
					'nameExample'     => __( 'Ej.: Alexita', 'alexita-product-personalizer' ),
					'numExample'      => __( 'Ej.: 14', 'alexita-product-personalizer' ),
					'photoHint'       => __( 'JPG, PNG o WebP · máx. 2.5 MB', 'alexita-product-personalizer' ),
					'choosePhoto'     => __( 'Elegir foto', 'alexita-product-personalizer' ),
					'noFileSelected'  => __( 'Ninguna foto seleccionada', 'alexita-product-personalizer' ),
					'previewAlt'      => __( 'Vista previa de la foto', 'alexita-product-personalizer' ),
					'previewEmpty'    => __( 'Sin foto', 'alexita-product-personalizer' ),
					'fileTooLarge'    => __( 'La foto supera el máximo permitido de 2.5 MB.', 'alexita-product-personalizer' ),
					'missingPhoto'    => __( 'Falta la foto de la unidad %d.', 'alexita-product-personalizer' ),
					'missingCountry'  => __( 'Selecciona un país para la unidad %d.', 'alexita-product-personalizer' ),
					'uploading'       => __( 'Subiendo foto…', 'alexita-product-personalizer' ),
					'uploadFailed'    => __( 'No se pudo subir la foto. Intenta de nuevo.', 'alexita-product-personalizer' ),
					'uploadPending'   => __( 'Espera a que termine de subir la foto de la unidad %d.', 'alexita-product-personalizer' ),
				),
			)
		);
	}

	public static function render_fields() {
		global $product;

		if ( ! self::is_wc_product( $product ) || ! self::is_enabled_product( $product->get_id() ) ) {
			return;
		}

		wp_nonce_field( self::NONCE_ACTION, self::NONCE_NAME );
		?>
		<div id="alexita-personalizer" class="alexita-personalizer" data-max-file-size="<?php echo esc_attr( self::MAX_FILE_SIZE ); ?>">
			<header class="alexita-personalizer__header">
				<p class="alexita-personalizer__eyebrow"><?php echo esc_html__( 'Tu diseño único', 'alexita-product-personalizer' ); ?></p>
				<h3 class="alexita-personalizer__title"><?php echo esc_html__( 'Personaliza el tuyo', 'alexita-product-personalizer' ); ?></h3>
				<p class="alexita-personalizer__subtitle">
					<?php echo esc_html__( 'Nombre, número, país y foto por cada pieza. Si cambias la cantidad, se actualizan los formularios.', 'alexita-product-personalizer' ); ?>
				</p>
				<ul class="alexita-personalizer__chips" aria-hidden="true">
					<li><?php echo esc_html__( 'Nombre', 'alexita-product-personalizer' ); ?></li>
					<li><?php echo esc_html__( 'Número', 'alexita-product-personalizer' ); ?></li>
					<li><?php echo esc_html__( 'País', 'alexita-product-personalizer' ); ?></li>
					<li><?php echo esc_html__( 'Foto', 'alexita-product-personalizer' ); ?></li>
				</ul>
			</header>
			<div id="alexita-players-wrapper" class="alexita-players-wrapper" role="group" aria-label="<?php echo esc_attr__( 'Datos de personalización', 'alexita-product-personalizer' ); ?>"></div>
		</div>
		<?php
	}

	public static function replace_loop_add_to_cart( $html, $product, $args ) {
		if ( ! self::is_wc_product( $product ) || ! self::is_enabled_product( $product->get_id() ) ) {
			return $html;
		}

		return sprintf(
			'<a href="%s" class="button alexita-personalize-button">%s</a>',
			esc_url( get_permalink( $product->get_id() ) ),
			esc_html__( 'Personalizar', 'alexita-product-personalizer' )
		);
	}

	public static function validate_and_prepare_personalization( $passed, $product_id, $quantity, $variation_id = 0, $variations = array(), $cart_item_data = array() ) {
		$enabled_id = $variation_id ? $variation_id : $product_id;

		if ( ! self::is_enabled_product( $enabled_id ) ) {
			return $passed;
		}

		$quantity = max( 1, absint( $quantity ) );

		if ( ! isset( $_POST[ self::NONCE_NAME ] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ self::NONCE_NAME ] ) ), self::NONCE_ACTION ) ) {
			wc_add_notice( __( 'No se pudo validar la personalización. Recarga la página e intenta nuevamente.', 'alexita-product-personalizer' ), 'error' );
			return false;
		}

		$players_post = isset( $_POST['alexita_players'] ) && is_array( $_POST['alexita_players'] )
			? wp_unslash( $_POST['alexita_players'] )
			: array();

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$prepared = array();

		for ( $i = 0; $i < $quantity; $i++ ) {
			$player_number = $i + 1;

			$name = isset( $players_post[ $i ]['name'] ) ? sanitize_text_field( $players_post[ $i ]['name'] ) : '';
			$number = isset( $players_post[ $i ]['number'] ) ? sanitize_text_field( $players_post[ $i ]['number'] ) : '';
			$country_code = isset( $players_post[ $i ]['country'] ) ? sanitize_text_field( $players_post[ $i ]['country'] ) : '';
			$country = self::get_country_by_code( $country_code );

			if ( '' === $name ) {
				wc_add_notice( sprintf( __( 'Falta el nombre del Jugador %d.', 'alexita-product-personalizer' ), $player_number ), 'error' );
				return false;
			}

			if ( self::str_length( $name ) > 30 ) {
				wc_add_notice( sprintf( __( 'El nombre del Jugador %d no debe pasar de 30 caracteres.', 'alexita-product-personalizer' ), $player_number ), 'error' );
				return false;
			}

			if ( '' === $number || ! preg_match( '/^[0-9]{1,2}$/', $number ) ) {
				wc_add_notice( sprintf( __( 'El número del Jugador %d debe tener 1 o 2 dígitos.', 'alexita-product-personalizer' ), $player_number ), 'error' );
				return false;
			}

			if ( ! $country ) {
				wc_add_notice( sprintf( __( 'Selecciona un país válido para la unidad %d.', 'alexita-product-personalizer' ), $player_number ), 'error' );
				return false;
			}

			$photo_url = isset( $players_post[ $i ]['photo_url'] ) ? esc_url_raw( wp_unslash( $players_post[ $i ]['photo_url'] ) ) : '';

			if ( $photo_url && self::is_valid_uploaded_photo_url( $photo_url ) ) {
				$prepared[] = array(
					'name'         => $name,
					'number'       => $number,
					'country_code' => $country['code'],
					'country_name' => $country['name'],
					'country_flag' => $country['flag'],
					'photo_url'    => $photo_url,
					'photo_file'   => sanitize_text_field( self::url_to_upload_path( $photo_url ) ),
					'photo_type'   => '',
				);
				continue;
			}

			$file = self::get_player_file( $i );
			$file_error = self::validate_file( $file, $player_number );

			if ( $file_error ) {
				wc_add_notice( $file_error, 'error' );
				return false;
			}

			$upload = wp_handle_upload(
				$file,
				array(
					'test_form' => false,
					'mimes'     => self::allowed_mimes(),
				)
			);

			if ( empty( $upload['url'] ) || ! empty( $upload['error'] ) ) {
				$message = ! empty( $upload['error'] ) ? $upload['error'] : __( 'Error desconocido al subir la imagen.', 'alexita-product-personalizer' );
				wc_add_notice( sprintf( __( 'No se pudo subir la foto del Jugador %1$d: %2$s', 'alexita-product-personalizer' ), $player_number, esc_html( $message ) ), 'error' );
				return false;
			}

			$prepared[] = array(
				'name'         => $name,
				'number'       => $number,
				'country_code' => $country['code'],
				'country_name' => $country['name'],
				'country_flag' => $country['flag'],
				'photo_url'    => esc_url_raw( $upload['url'] ),
				'photo_file'   => isset( $upload['file'] ) ? sanitize_text_field( $upload['file'] ) : '',
				'photo_type'   => isset( $upload['type'] ) ? sanitize_text_field( $upload['type'] ) : '',
			);
		}

		self::$prepared_personalization = $prepared;

		return $passed;
	}

	public static function add_cart_item_data( $cart_item_data, $product_id, $variation_id, $quantity ) {
		$enabled_id = $variation_id ? $variation_id : $product_id;

		if ( ! self::is_enabled_product( $enabled_id ) ) {
			return $cart_item_data;
		}

		if ( empty( self::$prepared_personalization ) ) {
			return $cart_item_data;
		}

		$cart_item_data['alexita_personalization'] = self::$prepared_personalization;
		$cart_item_data['alexita_unique_key'] = md5( wp_json_encode( self::$prepared_personalization ) . microtime( true ) );

		return $cart_item_data;
	}

	public static function display_cart_item_data( $item_data, $cart_item ) {
		if ( empty( $cart_item['alexita_personalization'] ) || ! is_array( $cart_item['alexita_personalization'] ) ) {
			return $item_data;
		}

		foreach ( $cart_item['alexita_personalization'] as $index => $player ) {
			$player_number = $index + 1;
			$name = isset( $player['name'] ) ? $player['name'] : '';
			$number = isset( $player['number'] ) ? $player['number'] : '';
			$country_flag = isset( $player['country_flag'] ) ? $player['country_flag'] : '';
			$country_name = isset( $player['country_name'] ) ? $player['country_name'] : '';
			$photo_url = isset( $player['photo_url'] ) ? $player['photo_url'] : '';

			$photo_link = $photo_url
				? sprintf( '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>', esc_url( $photo_url ), esc_html__( 'Ver foto', 'alexita-product-personalizer' ) )
				: esc_html__( 'Sin foto', 'alexita-product-personalizer' );

			$country_display = trim( $country_flag . ' ' . $country_name );

			$display = sprintf(
				'%s: %s | %s: %s | %s: %s | %s',
				esc_html__( 'Nombre', 'alexita-product-personalizer' ),
				esc_html( $name ),
				esc_html__( 'Número', 'alexita-product-personalizer' ),
				esc_html( $number ),
				esc_html__( 'País', 'alexita-product-personalizer' ),
				esc_html( $country_display ),
				$photo_link
			);

			$item_data[] = array(
				'key'     => sprintf( __( 'Jugador %d', 'alexita-product-personalizer' ), $player_number ),
				'value'   => wp_kses_post( $display ),
				'display' => wp_kses_post( $display ),
			);
		}

		return $item_data;
	}

	public static function save_order_item_meta( $item, $cart_item_key, $values, $order ) {
		if ( empty( $values['alexita_personalization'] ) || ! is_array( $values['alexita_personalization'] ) ) {
			return;
		}

		foreach ( $values['alexita_personalization'] as $index => $player ) {
			$player_number = $index + 1;

			$item->add_meta_data( sprintf( 'Jugador %d - Nombre', $player_number ), isset( $player['name'] ) ? $player['name'] : '', true );
			$item->add_meta_data( sprintf( 'Jugador %d - Número', $player_number ), isset( $player['number'] ) ? $player['number'] : '', true );

			$country_meta = '';
			if ( ! empty( $player['country_flag'] ) || ! empty( $player['country_name'] ) ) {
				$country_meta = trim( ( isset( $player['country_flag'] ) ? $player['country_flag'] : '' ) . ' ' . ( isset( $player['country_name'] ) ? $player['country_name'] : '' ) );
			}
			$item->add_meta_data( sprintf( 'Jugador %d - País', $player_number ), $country_meta, true );
			$item->add_meta_data( sprintf( 'Jugador %d - Foto', $player_number ), isset( $player['photo_url'] ) ? $player['photo_url'] : '', true );
		}
	}

	public static function prevent_cart_quantity_change( $passed, $cart_item_key, $values, $quantity ) {
		if ( empty( $values['alexita_personalization'] ) ) {
			return $passed;
		}

		$original_quantity = isset( $values['quantity'] ) ? absint( $values['quantity'] ) : 0;
		$new_quantity = absint( $quantity );

		if ( $original_quantity && $new_quantity !== $original_quantity ) {
			wc_add_notice( __( 'Para cambiar la cantidad de un producto personalizado, elimínalo del carrito y vuelve a agregarlo con los datos de cada jugador.', 'alexita-product-personalizer' ), 'error' );
			return false;
		}

		return $passed;
	}

	public static function lock_cart_quantity_input( $product_quantity, $cart_item_key, $cart_item ) {
		if ( empty( $cart_item['alexita_personalization'] ) ) {
			return $product_quantity;
		}

		$quantity = isset( $cart_item['quantity'] ) ? absint( $cart_item['quantity'] ) : 1;

		return sprintf(
			'<strong>%1$d</strong><input type="hidden" name="cart[%2$s][qty]" value="%1$d">',
			$quantity,
			esc_attr( $cart_item_key )
		);
	}

	public static function ajax_upload_player_photo() {
		if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), self::UPLOAD_NONCE_ACTION ) ) {
			wp_send_json_error(
				array( 'message' => __( 'No se pudo validar la subida. Recarga la página.', 'alexita-product-personalizer' ) ),
				403
			);
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';

		$file = isset( $_FILES['photo'] ) ? $_FILES['photo'] : null;
		$error = self::validate_file( $file, 1 );

		if ( $error ) {
			wp_send_json_error( array( 'message' => $error ), 400 );
		}

		$upload = wp_handle_upload(
			$file,
			array(
				'test_form' => false,
				'mimes'     => self::allowed_mimes(),
			)
		);

		if ( empty( $upload['url'] ) || ! empty( $upload['error'] ) ) {
			$message = ! empty( $upload['error'] ) ? $upload['error'] : __( 'Error desconocido al subir la imagen.', 'alexita-product-personalizer' );
			wp_send_json_error( array( 'message' => $message ), 500 );
		}

		wp_send_json_success(
			array(
				'url'  => esc_url_raw( $upload['url'] ),
				'file' => isset( $upload['file'] ) ? sanitize_text_field( $upload['file'] ) : '',
				'type' => isset( $upload['type'] ) ? sanitize_text_field( $upload['type'] ) : '',
			)
		);
	}

	private static function is_valid_uploaded_photo_url( $url ) {
		$url = esc_url_raw( $url );

		if ( ! $url ) {
			return false;
		}

		$uploads = wp_upload_dir();

		if ( empty( $uploads['baseurl'] ) ) {
			return false;
		}

		return 0 === strpos( $url, trailingslashit( $uploads['baseurl'] ) );
	}

	private static function url_to_upload_path( $url ) {
		$uploads = wp_upload_dir();

		if ( empty( $uploads['baseurl'] ) || empty( $uploads['basedir'] ) ) {
			return '';
		}

		return str_replace( trailingslashit( $uploads['baseurl'] ), trailingslashit( $uploads['basedir'] ), $url );
	}

	private static function normalize_uploaded_file( $file ) {
		if ( empty( $file ) || ! is_array( $file ) ) {
			return null;
		}

		if ( ! isset( $file['tmp_name'] ) || '' === $file['tmp_name'] ) {
			return null;
		}

		if ( isset( $file['error'] ) && UPLOAD_ERR_NO_FILE === (int) $file['error'] ) {
			return null;
		}

		return $file;
	}

	private static function get_player_file( $index ) {
		$index = absint( $index );

		// Campo plano alexita_photo_0 (fiable en móvil).
		$flat_key = 'alexita_photo_' . $index;
		if ( ! empty( $_FILES[ $flat_key ] ) ) {
			$file = self::normalize_uploaded_file( $_FILES[ $flat_key ] );
			if ( $file ) {
				return $file;
			}
		}

		// Compatibilidad: alexita_players[0][photo].
		if ( ! empty( $_FILES['alexita_players'] ) && is_array( $_FILES['alexita_players'] ) ) {
			$uploads = $_FILES['alexita_players'];
			$keys    = array( $index, (string) $index );

			foreach ( $keys as $key ) {
				if ( ! isset( $uploads['name'][ $key ]['photo'] ) ) {
					continue;
				}

				$file = array();

				foreach ( array( 'name', 'type', 'tmp_name', 'error', 'size' ) as $field ) {
					if ( isset( $uploads[ $field ][ $key ]['photo'] ) ) {
						$file[ $field ] = $uploads[ $field ][ $key ]['photo'];
					}
				}

				$file = self::normalize_uploaded_file( $file );
				if ( $file ) {
					return $file;
				}
			}
		}

		return null;
	}

	private static function validate_file( $file, $player_number ) {
		if ( empty( $file ) ) {
			return sprintf( __( 'Falta la foto de la unidad %d. Vuelve a elegir la imagen y agrega al carrito.', 'alexita-product-personalizer' ), $player_number );
		}

		if ( isset( $file['error'] ) && UPLOAD_ERR_NO_FILE === (int) $file['error'] ) {
			return sprintf( __( 'Falta la foto de la unidad %d. Vuelve a elegir la imagen y agrega al carrito.', 'alexita-product-personalizer' ), $player_number );
		}

		if ( isset( $file['error'] ) && UPLOAD_ERR_OK !== (int) $file['error'] ) {
			if ( UPLOAD_ERR_INI_SIZE === (int) $file['error'] || UPLOAD_ERR_FORM_SIZE === (int) $file['error'] ) {
				return sprintf( __( 'La foto de la unidad %d supera el límite del servidor.', 'alexita-product-personalizer' ), $player_number );
			}
			return sprintf( __( 'La foto de la unidad %d no se pudo subir correctamente.', 'alexita-product-personalizer' ), $player_number );
		}

		if ( empty( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
			return sprintf( __( 'La foto de la unidad %d no llegó al servidor. Usa JPG, PNG o WebP e intenta de nuevo.', 'alexita-product-personalizer' ), $player_number );
		}

		if ( isset( $file['size'] ) && absint( $file['size'] ) > self::MAX_FILE_SIZE ) {
			return sprintf( __( 'La foto de la unidad %d no debe pesar más de 2.5 MB.', 'alexita-product-personalizer' ), $player_number );
		}

		$checked = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], self::allowed_mimes() );

		if ( empty( $checked['type'] ) || ! in_array( $checked['type'], array_values( self::allowed_mimes() ), true ) ) {
			return sprintf( __( 'La foto de la unidad %d debe ser JPG, PNG o WebP.', 'alexita-product-personalizer' ), $player_number );
		}

		return false;
	}

	private static function allowed_mimes() {
		return array(
			'jpg|jpeg|jpe' => 'image/jpeg',
			'png'          => 'image/png',
			'webp'         => 'image/webp',
		);
	}
}

Alexita_Product_Personalizer::init();
