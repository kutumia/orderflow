(function (blocks, element, editor, components) {
  var el = element.createElement;
  var InspectorControls = editor.InspectorControls;
  var TextControl = components.TextControl;
  var PanelBody = components.PanelBody;

  blocks.registerBlockType("orderflow/menu", {
    title: "OrderFlow Menu",
    icon: "cart",
    category: "embed",
    description: "Embed your OrderFlow online ordering menu.",
    attributes: {
      slug: { type: "string", default: "" },
      height: { type: "string", default: "700px" },
    },
    edit: function (props) {
      var slug = props.attributes.slug;
      var height = props.attributes.height;

      return el(
        "div",
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: "OrderFlow Settings", initialOpen: true },
            el(TextControl, {
              label: "Restaurant Slug",
              value: slug,
              onChange: function (val) { props.setAttributes({ slug: val }); },
              help: "Your OrderFlow restaurant slug",
            }),
            el(TextControl, {
              label: "Height",
              value: height,
              onChange: function (val) { props.setAttributes({ height: val }); },
            })
          )
        ),
        slug
          ? el("iframe", {
              src: "https://orderflow.co.uk/" + slug + "?embed=true",
              style: { width: "100%", height: height, border: "none", borderRadius: "12px" },
              title: "OrderFlow Menu Preview",
            })
          : el(
              "div",
              {
                style: {
                  padding: "40px",
                  textAlign: "center",
                  background: "#f5f5f5",
                  borderRadius: "12px",
                  color: "#666",
                },
              },
              el("p", { style: { fontWeight: "600" } }, "OrderFlow Menu"),
              el("p", null, "Enter your restaurant slug in the block settings.")
            )
      );
    },
    save: function () {
      return null; // Dynamic block — rendered server-side
    },
  });
})(
  window.wp.blocks,
  window.wp.element,
  window.wp.blockEditor || window.wp.editor,
  window.wp.components
);
