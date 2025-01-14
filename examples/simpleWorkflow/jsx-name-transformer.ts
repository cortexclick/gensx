import * as ts from "typescript";

function getComponentName(node: ts.Expression): string {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    // For Component calls like gsx.Component(...), use the variable name it's assigned to
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    return node.expression.text;
  }
  return "";
}

function processJsxCall(
  node: ts.CallExpression,
  _: ts.TransformationContext,
  outerVisitor: ts.Visitor,
): ts.Node {
  // Get the component type (first argument)
  const componentArg = node.arguments[0];

  // Get the props object (second argument)
  const propsArg = node.arguments[1];
  if (!ts.isObjectLiteralExpression(propsArg)) {
    return node;
  }

  // Process children prop if it exists
  const updatedProps = ts.factory.updateObjectLiteralExpression(
    propsArg,
    propsArg.properties.map((prop) => {
      if (
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === "children"
      ) {
        // If it's an arrow function, we need to process its body
        if (ts.isArrowFunction(prop.initializer)) {
          const visitedBody = ts.visitNode(prop.initializer.body, outerVisitor);
          if (
            visitedBody !== prop.initializer.body &&
            ts.isExpression(visitedBody)
          ) {
            return ts.factory.updatePropertyAssignment(
              prop,
              prop.name,
              ts.factory.updateArrowFunction(
                prop.initializer,
                prop.initializer.modifiers,
                prop.initializer.typeParameters,
                prop.initializer.parameters,
                prop.initializer.type,
                prop.initializer.equalsGreaterThanToken,
                visitedBody,
              ),
            );
          }
        }

        // For non-arrow function children, visit the value directly
        const visitedValue = ts.visitNode(prop.initializer, outerVisitor);
        if (
          visitedValue !== prop.initializer &&
          ts.isExpression(visitedValue)
        ) {
          return ts.factory.updatePropertyAssignment(
            prop,
            prop.name,
            visitedValue,
          );
        }
      }
      return prop;
    }),
  );

  // If we already have an element name, just update the props
  if (node.arguments.length > 2) {
    return ts.factory.updateCallExpression(
      node,
      node.expression,
      node.typeArguments,
      [node.arguments[0], updatedProps, node.arguments[2]],
    );
  }

  // Add element name for new JSX calls
  const elementName = getComponentName(componentArg);

  return ts.factory.createCallExpression(node.expression, node.typeArguments, [
    componentArg,
    updatedProps,
    ts.factory.createStringLiteral(elementName),
  ]);
}

export function createJsxNameTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const visitor: ts.Visitor = (node): ts.Node => {
      // Handle JSX expressions (the {...} parts)
      if (ts.isJsxExpression(node)) {
        return node.expression || ts.factory.createIdentifier("undefined");
      }

      // Handle arrow functions to process their bodies
      if (ts.isArrowFunction(node)) {
        // For block bodies, visit each statement
        if (ts.isBlock(node.body)) {
          const visitedBlock = ts.visitEachChild(node.body, visitor, context);
          return ts.factory.updateArrowFunction(
            node,
            node.modifiers,
            node.typeParameters,
            node.parameters,
            node.type,
            node.equalsGreaterThanToken,
            visitedBlock,
          );
        }

        // For expression bodies, visit the expression
        const visitedBody = ts.visitNode(node.body, visitor);
        if (visitedBody !== node.body && ts.isExpression(visitedBody)) {
          // If it's a parenthesized expression, we need to visit its contents
          if (ts.isParenthesizedExpression(visitedBody)) {
            const innerVisited = ts.visitNode(visitedBody.expression, visitor);
            if (
              innerVisited !== visitedBody.expression &&
              ts.isExpression(innerVisited)
            ) {
              return ts.factory.updateArrowFunction(
                node,
                node.modifiers,
                node.typeParameters,
                node.parameters,
                node.type,
                node.equalsGreaterThanToken,
                ts.factory.createParenthesizedExpression(innerVisited),
              );
            }
          }

          return ts.factory.updateArrowFunction(
            node,
            node.modifiers,
            node.typeParameters,
            node.parameters,
            node.type,
            node.equalsGreaterThanToken,
            visitedBody,
          );
        }
        return node;
      }

      // Handle JSX elements directly
      if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName.getText();

        // Process JSX attributes first
        const processedAttributes = node.openingElement.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attr) => {
            const name = attr.name.getFullText();
            let value: ts.Expression;

            if (attr.initializer) {
              if (ts.isJsxExpression(attr.initializer)) {
                // Process JSX expressions in attributes (including function children)
                if (attr.initializer.expression) {
                  const visitedExpr = ts.visitNode(
                    attr.initializer.expression,
                    visitor,
                  );
                  value = ts.isExpression(visitedExpr)
                    ? visitedExpr
                    : ts.factory.createTrue();
                } else {
                  value = ts.factory.createTrue();
                }
              } else {
                value = attr.initializer;
              }
            } else {
              value = ts.factory.createTrue();
            }

            return ts.factory.createPropertyAssignment(
              name,
              ts.isExpression(value) ? value : ts.factory.createTrue(),
            );
          });

        // Transform children between tags
        const transformedChildren = node.children
          .map((child) => {
            if (ts.isJsxExpression(child)) {
              // Visit the expression inside JSX expression
              if (child.expression) {
                const visitedExpr = ts.visitNode(child.expression, visitor);
                return ts.isExpression(visitedExpr) ? visitedExpr : undefined;
              }
            }
            return ts.visitNode(child, visitor);
          })
          .filter(
            (child): child is ts.Expression =>
              child !== undefined && ts.isExpression(child),
          );

        const hasChildren = transformedChildren.length > 0;

        // Create props with children
        const props = ts.factory.createObjectLiteralExpression([
          // Processed attributes
          ...processedAttributes,
          // Add children if present
          ...(hasChildren
            ? [
                ts.factory.createPropertyAssignment(
                  "children",
                  transformedChildren.length === 1
                    ? transformedChildren[0]
                    : ts.factory.createArrayLiteralExpression(
                        transformedChildren,
                      ),
                ),
              ]
            : []),
        ]);

        // Create the _jsx/_jsxs call with element name
        const jsxCall = ts.factory.createCallExpression(
          ts.factory.createIdentifier(hasChildren ? "_jsxs" : "_jsx"),
          undefined,
          [
            ts.factory.createIdentifier(tagName),
            props,
            ts.factory.createStringLiteral(tagName),
          ],
        );

        // Visit the created call to handle any nested JSX
        return ts.visitNode(jsxCall, visitor);
      }

      // Handle JSX self-closing elements
      if (ts.isJsxSelfClosingElement(node)) {
        const tagName = node.tagName.getText();

        // Create the _jsx call with element name
        const jsxCall = ts.factory.createCallExpression(
          ts.factory.createIdentifier("_jsx"),
          undefined,
          [
            ts.factory.createIdentifier(tagName),
            ts.factory.createObjectLiteralExpression(
              node.attributes.properties
                .filter(ts.isJsxAttribute)
                .map((attr) => {
                  const name = attr.name.getFullText();
                  const value = attr.initializer
                    ? ts.isJsxExpression(attr.initializer)
                      ? attr.initializer.expression || ts.factory.createTrue()
                      : attr.initializer
                    : ts.factory.createTrue();
                  return ts.factory.createPropertyAssignment(
                    name,
                    ts.isExpression(value) ? value : ts.factory.createTrue(),
                  );
                }),
            ),
            ts.factory.createStringLiteral(tagName),
          ],
        );

        // Visit the created call to handle any nested JSX
        return ts.visitNode(jsxCall, visitor);
      }

      // Handle existing _jsx calls
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "_jsx" || node.expression.text === "_jsxs")
      ) {
        // Only process if we don't have an element name
        if (node.arguments.length < 3) {
          const result = processJsxCall(node, context, visitor);
          // Visit the result again to handle any nested JSX
          return ts.visitNode(result, visitor);
        }
        return node;
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile) => {
      return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
    };
  };
}
