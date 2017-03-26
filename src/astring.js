// Astring is a tiny and fast JavaScript code generator from an ESTree-compliant AST.
//
// Astring was written by David Bonnet and released under an MIT license.
//
// The Git repository for Astring is available at:
// https://github.com/davidbonnet/astring.git
//
// Please use the GitHub bug tracker to report issues:
// https://github.com/davidbonnet/astring/issues

const { stringify } = JSON


const OPERATOR_PRECEDENCE = {
	'||': 3,
	'&&': 4,
	'|': 5,
	'^': 6,
	'&': 7,
	'==': 8,
	'!=': 8,
	'===': 8,
	'!==': 8,
	'<': 9,
	'>': 9,
	'<=': 9,
	'>=': 9,
	'in': 9,
	'instanceof': 9,
	'<<': 10,
	'>>': 10,
	'>>>': 10,
	'+': 11,
	'-': 11,
	'*': 12,
	'%': 12,
	'/': 12,
	'**': 13,
}


const EXPRESSIONS_PRECEDENCE = {
	// Definitions
	ArrayExpression: 20,
	TaggedTemplateExpression: 20,
	ThisExpression: 20,
	Identifier: 20,
	Literal: 18,
	TemplateLiteral: 20,
	Super: 20,
	SequenceExpression: 20,
	// Operations
	MemberExpression: 19,
	CallExpression: 19,
	NewExpression: 19,
	ArrowFunctionExpression: 18,
	// Other definitions
	// Value 17 enables parenthesis in an `ExpressionStatement` node
	ClassExpression: 17,
	FunctionExpression: 17,
	ObjectExpression: 17,
	// Other operations
	UpdateExpression: 16,
	UnaryExpression: 15,
	BinaryExpression: 14,
	LogicalExpression: 13,
	ConditionalExpression: 4,
	AssignmentExpression: 3,
	YieldExpression: 2,
	RestElement: 1,
}


function formatSequence( state, nodes ) {
	/*
	Writes into `state` a sequence of `nodes`.
	*/
	const { generator } = state
	state.write( '(' )
	if ( nodes != null && nodes.length > 0 ) {
		generator[ nodes[ 0 ].type ]( nodes[ 0 ], state )
		const { length } = nodes
		for ( let i = 1; i < length; i++ ) {
			let param = nodes[ i ]
			state.write( ', ' )
			generator[ param.type ]( param, state )
		}
	}
	state.write( ')' )
}


function expressionNeedsParenthesis( node, parentNode, isRightHand ) {
	const nodePrecedence = EXPRESSIONS_PRECEDENCE[ node.type ]
	const parentNodePrecedence = EXPRESSIONS_PRECEDENCE[ parentNode.type ]
	if ( nodePrecedence !== parentNodePrecedence )
		// Different node types
		return nodePrecedence < parentNodePrecedence
	if ( nodePrecedence !== 13 && nodePrecedence !== 14 )
		// Not a `LogicalExpression` or `BinaryExpression`
		return false
	if ( node.operator === '**' && parentNode.operator === '**' )
		// Exponentiation operator has right-to-left associativity
		return !isRightHand
	if ( isRightHand )
		// Parenthesis are used if both operators have the same precedence
		return OPERATOR_PRECEDENCE[ node.operator ] <= OPERATOR_PRECEDENCE[ parentNode.operator ]
	return OPERATOR_PRECEDENCE[ node.operator ] < OPERATOR_PRECEDENCE[ parentNode.operator ]
}


function formatBinaryExpressionPart( state, node, parentNode, isRightHand ) {
	/*
	Writes into `state` a left-hand or right-hand expression `node`
	from a binary expression applying the provided `operator`.
	The `isRightHand` parameter should be `true` if the `node` is a right-hand argument.
	*/
	const { generator } = state
	if ( expressionNeedsParenthesis( node, parentNode, isRightHand ) ) {
		state.write( '(' )
		generator[ node.type ]( node, state )
		state.write( ')' )
	} else {
		generator[ node.type ]( node, state )
	}
}


function reindent( text, indentation ) {
	/*
	Returns the `text` string reindented with the provided `indentation`.
	*/
	text = text.trimRight()
	let indents = '\n'
	let secondLine = false
	const { length } = text
	for ( let i = 0; i < length; i++ ) {
		let char = text[ i ]
		if ( secondLine ) {
			if ( char === ' ' || char === '\t' ) {
				indents += char
			} else {
				return indentation + text.trimLeft().split( indents ).join( '\n' + indentation )
			}
		} else {
			if ( char === '\n' ) {
				secondLine = true
			}
		}
	}
	return indentation + text.trimLeft()
}


function formatComments( state, comments, indent, lineEnd ) {
	/*
	Writes into `state` the provided list of `comments`, with the given `indent` and `lineEnd` strings.
	Line comments will end with `"\n"` regardless of the value of `lineEnd`.
	Expects to start on a new unindented line.
	*/
	const { length } = comments
	for ( let i = 0; i < length; i++ ) {
		let comment = comments[ i ]
		state.write( indent )
		if ( comment.type[ 0 ] === 'L' )
			// Line comment
			state.write( '// ' + comment.value.trim() + '\n' )
		else
			// Block comment
			state.write(
				'/*' + lineEnd +
				reindent( comment.value, indent ) + lineEnd +
				indent + '*/' + lineEnd
			)
	}
}


function hasCallExpression( node ) {
	/*
	Returns `true` if the provided `node` contains a call expression and `false` otherwise.
	*/
	while ( node != null ) {
		let { type } = node
		if ( type[ 0 ] === 'C' && type[ 1 ] === 'a' ) {
			// Is CallExpression
			return true
		} else if ( type[ 0 ] === 'M' && type[ 1 ] === 'e' && type[ 2 ] === 'm' ) {
			// Is MemberExpression
			node = node.object
		} else {
			return false
		}
	}
}


let
	ForInStatement,
	FunctionDeclaration,
	RestElement,
	BinaryExpression,
	ArrayExpression,
	BlockStatement


export const defaultGenerator = {
	Program( node, state ) {
		const indent = state.indent.repeat( state.indentLevel )
		const { lineEnd, writeComments } = state
		if ( writeComments && node.comments != null )
			formatComments( state, node.comments, indent, lineEnd )
		let statements = node.body
		const { length } = statements
		for ( let i = 0; i < length; i++ ) {
			let statement = statements[ i ]
			if ( writeComments && statement.comments != null )
				formatComments( state, statement.comments, indent, lineEnd )
			state.write( indent )
			this[ statement.type ]( statement, state )
			state.write( lineEnd )
		}
		if ( writeComments && node.trailingComments != null )
			formatComments( state, node.trailingComments, indent, lineEnd )
	},
	BlockStatement: BlockStatement = function( node, state ) {
		const indent = state.indent.repeat( state.indentLevel++ )
		const { lineEnd, writeComments } = state
		const statementIndent = indent + state.indent
		state.write( '{' )
		let statements = node.body
		if ( statements != null && statements.length > 0 ) {
			state.write( lineEnd )
			if ( writeComments && node.comments != null ) {
				formatComments( state, node.comments, statementIndent, lineEnd )
			}
			const { length } = statements
			for ( let i = 0; i < length; i++ ) {
				let statement = statements[ i ]
				if ( writeComments && statement.comments != null )
					formatComments( state, statement.comments, statementIndent, lineEnd )
				state.write( statementIndent )
				this[ statement.type ]( statement, state )
				state.write( lineEnd )
			}
			state.write( indent )
		} else {
			if ( writeComments && node.comments != null ) {
				state.write( lineEnd )
				formatComments( state, node.comments, statementIndent, lineEnd )
				state.write( indent )
			}
		}
		if ( writeComments && node.trailingComments != null )
			formatComments( state, node.trailingComments, statementIndent, lineEnd )
		state.write( '}' )
		state.indentLevel--
	},
	ClassBody: BlockStatement,
	EmptyStatement( node, state ) {
		state.write( ';' )
	},
	ExpressionStatement( node, state ) {
		const precedence = EXPRESSIONS_PRECEDENCE[ node.expression.type ]
		if ( precedence === 17 || ( precedence === 3 && node.expression.left.type[ 0 ] === 'O' ) ) {
			// Should always have parentheses or is an AssignmentExpression to an ObjectPattern
			state.write( '(' )
			this[ node.expression.type ]( node.expression, state )
			state.write( ')' )
		} else {
			this[ node.expression.type ]( node.expression, state )
		}
		state.write( ';' )
	},
	IfStatement( node, state ) {
		state.write( 'if (' )
		this[ node.test.type ]( node.test, state )
		state.write( ') ' )
		this[ node.consequent.type ]( node.consequent, state )
		if ( node.alternate != null ) {
			state.write( ' else ' )
			this[ node.alternate.type ]( node.alternate, state )
		}
	},
	LabeledStatement( node, state ) {
		this[ node.label.type ]( node.label, state )
		state.write( ': ' )
		this[ node.body.type ]( node.body, state )
	},
	BreakStatement( node, state ) {
		state.write( 'break' )
		if ( node.label != null ) {
			state.write( ' ' )
			this[ node.label.type ]( node.label, state )
		}
		state.write( ';' )
	},
	ContinueStatement( node, state ) {
		state.write( 'continue' )
		if ( node.label != null ) {
			state.write( ' ' )
			this[ node.label.type ]( node.label, state )
		}
		state.write( ';' )
	},
	WithStatement( node, state ) {
		state.write( 'with (' )
		this[ node.object.type ]( node.object, state )
		state.write( ') ' )
		this[ node.body.type ]( node.body, state )
	},
	SwitchStatement( node, state ) {
		const indent = state.indent.repeat( state.indentLevel++ )
		const { lineEnd, writeComments } = state
		state.indentLevel++
		const caseIndent = indent + state.indent
		const statementIndent = caseIndent + state.indent
		state.write( 'switch (' )
		this[ node.discriminant.type ]( node.discriminant, state )
		state.write( ') \{' + lineEnd )
		const { cases: occurences } = node
		const { length: occurencesCount } = occurences
		for ( let i = 0; i < occurencesCount; i++ ) {
			let occurence = occurences[ i ]
			if ( writeComments && occurence.comments != null )
				formatComments( state, occurence.comments, caseIndent, lineEnd )
			if ( occurence.test ) {
				state.write( caseIndent + 'case ' )
				this[ occurence.test.type ]( occurence.test, state )
				state.write( ':' + lineEnd )
			} else {
				state.write( caseIndent + 'default:' + lineEnd )
			}
			let { consequent } = occurence
			const { length: consequentCount } = consequent
			for ( let i = 0; i < consequentCount; i++ ) {
				let statement = consequent[ i ]
				if ( writeComments && statement.comments != null )
					formatComments( state, statement.comments, statementIndent, lineEnd )
				state.write( statementIndent )
				this[ statement.type ]( statement, state )
				state.write( lineEnd )
			}
		}
		state.indentLevel -= 2
		state.write( indent + '}' )
	},
	ReturnStatement( node, state ) {
		state.write( 'return' )
		if ( node.argument ) {
			state.write( ' ' )
			this[ node.argument.type ]( node.argument, state )
		}
		state.write( ';' )
	},
	ThrowStatement( node, state ) {
		state.write( 'throw ' )
		this[ node.argument.type ]( node.argument, state )
		state.write( ';' )
	},
	TryStatement( node, state ) {
		state.write( 'try ' )
		this[ node.block.type ]( node.block, state )
		if ( node.handler ) {
			let { handler } = node
			state.write( ' catch (' )
			this[ handler.param.type ]( handler.param, state )
			state.write( ') ' )
			this[ handler.body.type ]( handler.body, state )
		}
		if ( node.finalizer ) {
			state.write( ' finally ' )
			this[ node.finalizer.type ]( node.finalizer, state )
		}
	},
	WhileStatement( node, state ) {
		state.write( 'while (' )
		this[ node.test.type ]( node.test, state )
		state.write( ') ' )
		this[ node.body.type ]( node.body, state )
	},
	DoWhileStatement( node, state ) {
		state.write( 'do ' )
		this[ node.body.type ]( node.body, state )
		state.write( ' while (' )
		this[ node.test.type ]( node.test, state )
		state.write( ');' )
	},
	ForStatement( node, state ) {
		state.write( 'for (' )
		if ( node.init != null ) {
			const { init } = node
			state.noTrailingSemicolon = true
			this[ init.type ]( init, state )
			state.noTrailingSemicolon = false
		}
		state.write( '; ' )
		if ( node.test )
			this[ node.test.type ]( node.test, state )
		state.write( '; ' )
		if ( node.update )
			this[ node.update.type ]( node.update, state )
		state.write( ') ' )
		this[ node.body.type ]( node.body, state )
	},
	ForInStatement: ForInStatement = function( node, state ) {
		state.write( 'for (' )
		const { left } = node, { type } = left
		state.noTrailingSemicolon = true
		this[ type ]( left, state )
		state.noTrailingSemicolon = false
		// Identifying whether node.type is `ForInStatement` or `ForOfStatement`
		state.write( node.type[ 3 ] === 'I' ? ' in ' : ' of ' )
		this[ node.right.type ]( node.right, state )
		state.write( ') ' )
		this[ node.body.type ]( node.body, state )
	},
	ForOfStatement: ForInStatement,
	DebuggerStatement( node, state ) {
		state.write( 'debugger;' + state.lineEnd )
	},
	FunctionDeclaration: FunctionDeclaration = function( node, state ) {
		state.write(
			( node.async ? 'async ' : '' ) +
			( node.generator ? 'function* ' : 'function ' ) +
			( node.id ? node.id.name : '' ),
			node
		)
		formatSequence( state, node.params )
		state.write( ' ' )
		this[ node.body.type ]( node.body, state )
	},
	FunctionExpression: FunctionDeclaration,
	VariableDeclaration( node, state ) {
		const { declarations } = node
		state.write( node.kind + ' ' )
		const { length } = declarations
		if ( length > 0 ) {
			this.VariableDeclarator( declarations[ 0 ], state )
			for ( let i = 1; i < length; i++ ) {
				state.write( ', ' )
				this.VariableDeclarator( declarations[ i ], state )
			}
		}
		if ( state.noTrailingSemicolon !== true )
			state.write( ';' )
	},
	VariableDeclarator( node, state ) {
		this[ node.id.type ]( node.id, state )
		if ( node.init != null ) {
			state.write( ' = ' )
			this[ node.init.type ]( node.init, state )
		}
	},
	ClassDeclaration( node, state ) {
		state.write(
			'class ' +
			( node.id ? node.id.name : ' ' ),
			node
		)
		if ( node.superClass ) {
			state.write( 'extends ' )
			this[ node.superClass.type ]( node.superClass, state )
			state.write( ' ' )
		}
		this.ClassBody( node.body, state )
	},
	ImportDeclaration( node, state ) {
		state.write( 'import ' )
		const { specifiers } = node
		const { length } = specifiers
		if ( length > 0 ) {
			let i = 0
			while ( i < length ) {
				if ( i > 0 )
					state.write( ', ' )
				const specifier = specifiers[ i ]
				const type = specifier.type[ 6 ]
				if ( type === 'D' ) {
					// ImportDefaultSpecifier
					state.write( specifier.local.name )
					i++
				} else if ( type === 'N' ) {
					// ImportNamespaceSpecifier
					state.write( '* as ' + specifier.local.name )
					i++
				} else {
					// ImportSpecifier
					break
				}
			}
			if ( i < length ) {
				state.write( '{' )
				for ( ; ; ) {
					const specifier = specifiers[ i ]
					const { name } = specifier.imported
					state.write( name, specifier )
					if ( name !== specifier.local.name ) {
						state.write( ' as ' + specifier.local.name )
					}
					if ( ++i < length )
						state.write( ', ' )
					else
						break
				}
				state.write( '}' )
			}
			state.write( ' from ' )
		}
		this.Literal( node.source, state )
		state.write( ';' )
	},
	ExportDefaultDeclaration( node, state ) {
		state.write( 'export default ' )
		this[ node.declaration.type ]( node.declaration, state )
		if ( EXPRESSIONS_PRECEDENCE[ node.declaration.type ] && node.declaration.type[ 0 ] !== 'F' )
			// All expression nodes except `FunctionExpression`
			state.write( ';' )
	},
	ExportNamedDeclaration( node, state ) {
		state.write( 'export ' )
		if ( node.declaration ) {
			this[ node.declaration.type ]( node.declaration, state )
		} else {
			state.write( '{' )
			const { specifiers } = node, { length } = specifiers
			if ( length > 0 ) {
				for ( let i = 0; ; ) {
					let specifier = specifiers[ i ]
					let { name } = specifier.local
					state.write( name )
					if ( name !== specifier.exported.name )
						state.write( ' as ' + specifier.exported.name )
					if ( ++i < length )
						state.write( ', ' )
					else
						break
				}
			}
			state.write( '}' )
			if ( node.source ) {
				state.write( ' from ' )
				this.Literal( node.source, state )
			}
			state.write( ';' )
		}
	},
	ExportAllDeclaration( node, state ) {
		state.write( 'export * from ' )
		this.Literal( node.source, state )
		state.write( ';' )
	},
	MethodDefinition( node, state ) {
		if ( node.static )
			state.write( 'static ' )
		const kind = node.kind[ 0 ]
		if ( kind === 'g' || kind === 's' )
			// Getter or setter
			state.write( node.kind + ' ' )
		if ( node.value.async )
			state.write( 'async ' )
		if ( node.value.generator )
			state.write( '*' )
		if ( node.computed ) {
			state.write( '[' )
			this[ node.key.type ]( node.key, state )
			state.write( ']' )
		} else {
			this[ node.key.type ]( node.key, state )
		}
		formatSequence( state, node.value.params )
		state.write( ' ' )
		this[ node.value.body.type ]( node.value.body, state )
	},
	ClassExpression( node, state ) {
		this.ClassDeclaration( node, state )
	},
	ArrowFunctionExpression( node, state ) {
		const { params } = node
		if ( node.async )
			state.write( 'async ' )
		if ( params != null ) {
			// Omit parenthesis if only one named parameter
			if ( params.length === 1 && params[ 0 ].type[ 0 ] === 'I' ) {
				// If params[0].type[0] starts with 'I', it can't be `ImportDeclaration` nor `IfStatement` and thus is `Identifier`
				state.write( params[ 0 ].name )
			} else {
				formatSequence( state, node.params )
			}
		}
		state.write( ' => ' )
		if ( node.body.type[ 0 ] === 'O' ) {
			// Body is an object expression
			state.write( '(' )
			this.ObjectExpression( node.body, state )
			state.write( ')' )
		} else {
			this[ node.body.type ]( node.body, state )
		}
	},
	ThisExpression( node, state ) {
		state.write( 'this' )
	},
	Super( node, state ) {
		state.write( 'super' )
	},
	RestElement: RestElement = function( node, state ) {
		state.write( '...' )
		this[ node.argument.type ]( node.argument, state )
	},
	SpreadElement: RestElement,
	YieldExpression( node, state ) {
		state.write( node.delegate ? 'yield*' : 'yield' )
		if ( node.argument ) {
			state.write( ' ' )
			this[ node.argument.type ]( node.argument, state )
		}
	},
	AwaitExpression( node, state ) {
		state.write( 'await ' )
		if ( node.argument ) {
			this[ node.argument.type ]( node.argument, state )
		}
	},
	TemplateLiteral( node, state ) {
		const { quasis, expressions } = node
		state.write( '`' )
		const { length } = expressions
		for ( let i = 0; i < length; i++ ) {
			let expression = expressions[ i ]
			state.write( quasis[ i ].value.raw )
			state.write( '${' )
			this[ expression.type ]( expression, state )
			state.write( '}' )
		}
		state.write( quasis[ quasis.length - 1 ].value.raw )
		state.write( '`' )
	},
	TaggedTemplateExpression( node, state ) {
		this[ node.tag.type ]( node.tag, state )
		this[ node.quasi.type ]( node.quasi, state )
	},
	ArrayExpression: ArrayExpression = function( node, state ) {
		state.write( '[' )
		if ( node.elements.length > 0 ) {
			const { elements } = node, { length } = elements
			for ( let i = 0; ; ) {
				let element = elements[ i ]
				if ( element != null )
					this[ element.type ]( element, state )
				if ( ++i < length ) {
					state.write( ', ' )
				} else {
					if ( element == null )
						state.write( ', ' )
					break
				}
			}
		}
		state.write( ']' )
	},
	ArrayPattern: ArrayExpression,
	ObjectExpression( node, state ) {
		const indent = state.indent.repeat( state.indentLevel++ )
		const { lineEnd, writeComments } = state
		const propertyIndent = indent + state.indent
		state.write( '{' )
		if ( node.properties.length > 0 ) {
			state.write( lineEnd )
			if ( writeComments && node.comments != null )
				formatComments( state, node.comments, propertyIndent, lineEnd )
			const comma = ',' + lineEnd
			const { properties } = node, { length } = properties
			for ( let i = 0; ; ) {
				let property = properties[ i ]
				if ( writeComments && property.comments != null )
					formatComments( state, property.comments, propertyIndent, lineEnd )
				state.write( propertyIndent )
				this.Property( property, state )
				if ( ++i < length )
					state.write( comma )
				else
					break
			}
			state.write( lineEnd )
			if ( writeComments && node.trailingComments != null )
				formatComments( state, node.trailingComments, propertyIndent, lineEnd )
			state.write( indent + '}' )
		} else if ( writeComments ) {
			if ( node.comments != null ) {
				state.write( lineEnd )
				formatComments( state, node.comments, propertyIndent, lineEnd )
				if ( node.trailingComments != null )
					formatComments( state, node.trailingComments, propertyIndent, lineEnd )
				state.write( indent + '}' )
			} else if ( node.trailingComments != null ) {
				state.write( lineEnd )
				formatComments( state, node.trailingComments, propertyIndent, lineEnd )
				state.write( indent + '}' )
			} else {
				state.write( '}' )
			}
		} else {
			state.write( '}' )
		}
		state.indentLevel--
	},
	Property( node, state ) {
		if ( node.method || node.kind[ 0 ] !== 'i' ) {
			// Either a method or of kind `set` or `get` (not `init`)
			this.MethodDefinition( node, state )
		} else {
			if ( !node.shorthand ) {
				if ( node.computed ) {
					state.write( '[' )
					this[ node.key.type ]( node.key, state )
					state.write( ']' )
				} else {
					this[ node.key.type ]( node.key, state )
				}
				state.write( ': ' )
			}
			this[ node.value.type ]( node.value, state )
		}
	},
	ObjectPattern( node, state ) {
		state.write( '{' )
		if ( node.properties.length > 0 ) {
			const { properties } = node, { length } = properties
			for ( let i = 0; ; ) {
				this[ properties[ i ].type ]( properties[ i ], state )
				if ( ++i < length )
					state.write( ', ' )
				else
					break
			}
		}
		state.write( '}' )
	},
	SequenceExpression( node, state ) {
		formatSequence( state, node.expressions )
	},
	UnaryExpression( node, state ) {
		if ( node.prefix ) {
			state.write( node.operator )
			if ( node.operator.length > 1 )
				state.write( ' ' )
			if ( EXPRESSIONS_PRECEDENCE[ node.argument.type ] < EXPRESSIONS_PRECEDENCE.UnaryExpression ) {
				state.write( '(' )
				this[ node.argument.type ]( node.argument, state )
				state.write( ')' )
			} else {
				this[ node.argument.type ]( node.argument, state )
			}
		} else {
			// FIXME: This case never occurs
			this[ node.argument.type ]( node.argument, state )
			state.write( node.operator )
		}
	},
	UpdateExpression( node, state ) {
		// Always applied to identifiers or members, no parenthesis check needed
		if ( node.prefix ) {
			state.write( node.operator )
			this[ node.argument.type ]( node.argument, state )
		} else {
			this[ node.argument.type ]( node.argument, state )
			state.write( node.operator )
		}
	},
	AssignmentExpression( node, state ) {
		this[ node.left.type ]( node.left, state )
		state.write( ' ' + node.operator + ' ' )
		this[ node.right.type ]( node.right, state )
	},
	AssignmentPattern( node, state ) {
		this[ node.left.type ]( node.left, state )
		state.write( ' = ' )
		this[ node.right.type ]( node.right, state )
	},
	BinaryExpression: BinaryExpression = function( node, state ) {
		if ( node.operator === 'in' ) {
			// Avoids confusion in `for` loops initializers
			state.write( '(' )
			formatBinaryExpressionPart( state, node.left, node, false )
			state.write( ' ' + node.operator + ' ' )
			formatBinaryExpressionPart( state, node.right, node, true )
			state.write( ')' )
		} else {
			formatBinaryExpressionPart( state, node.left, node, false )
			state.write( ' ' + node.operator + ' ' )
			formatBinaryExpressionPart( state, node.right, node, true )
		}
	},
	LogicalExpression: BinaryExpression,
	ConditionalExpression( node, state ) {
		if ( EXPRESSIONS_PRECEDENCE[ node.test.type ] > EXPRESSIONS_PRECEDENCE.ConditionalExpression ) {
			this[ node.test.type ]( node.test, state )
		} else {
			state.write( '(' )
			this[ node.test.type ]( node.test, state )
			state.write( ')' )
		}
		state.write( ' ? ' )
		this[ node.consequent.type ]( node.consequent, state )
		state.write( ' : ' )
		this[ node.alternate.type ]( node.alternate, state )
	},
	NewExpression( node, state ) {
		state.write( 'new ' )
		if ( EXPRESSIONS_PRECEDENCE[ node.callee.type ] < EXPRESSIONS_PRECEDENCE.CallExpression
				|| hasCallExpression( node.callee ) ) {
			state.write( '(' )
			this[ node.callee.type ]( node.callee, state )
			state.write( ')' )
		} else {
			this[ node.callee.type ]( node.callee, state )
		}
		formatSequence( state, node[ 'arguments' ] )
	},
	CallExpression( node, state ) {
		if ( EXPRESSIONS_PRECEDENCE[ node.callee.type ] < EXPRESSIONS_PRECEDENCE.CallExpression ) {
			state.write( '(' )
			this[ node.callee.type ]( node.callee, state )
			state.write( ')' )
		} else {
			this[ node.callee.type ]( node.callee, state )
		}
		formatSequence( state, node[ 'arguments' ] )
	},
	MemberExpression( node, state ) {
		if ( EXPRESSIONS_PRECEDENCE[ node.object.type ] < EXPRESSIONS_PRECEDENCE.MemberExpression ) {
			state.write( '(' )
			this[ node.object.type ]( node.object, state )
			state.write( ')' )
		} else {
			this[ node.object.type ]( node.object, state )
		}
		if ( node.computed ) {
			state.write( '[' )
			this[ node.property.type ]( node.property, state )
			state.write( ']' )
		} else {
			state.write( '.' )
			this[ node.property.type ]( node.property, state )
		}
	},
	MetaProperty( node, state ) {
		state.write( node.meta.name + '.' + node.property.name )
	},
	Identifier( node, state ) {
		state.write( node.name )
	},
	Literal( node, state ) {
		if ( node.raw != null ) {
			state.write( node.raw )
		} else if ( node.regex != null ) {
			this.RegExpLiteral( node, state )
		} else {
			state.write( stringify( node.value ) )
		}
	},
	RegExpLiteral( node, state ) {
		const { regex } = node
		state.write(
			'new RegExp(' + stringify( regex.pattern ) + ', ' + stringify( regex.flags ) + ')'
		)
	},
}


const EMPTY_OBJECT = {}


class State {

	constructor( options ) {
		const setup = options == null ? EMPTY_OBJECT : options
		this.output = ''
		// Functional options
		if ( setup.output != null ) {
			this.output = setup.output
			this.write = this.writeToStream
		} else {
			this.output = ''
		}
		this.generator = setup.generator != null ? setup.generator : defaultGenerator
		// Source map
		this.map = setup.sourcemap ? new SourceMap() : null
		this.line = 1
		this.column = 0
		// Formating setup
		this.indent = setup.indent != null ? setup.indent : '\t'
		this.lineEnd = setup.lineEnd != null ? setup.lineEnd : '\n'
		this.indentLevel = setup.startingIndentLevel != null ? setup.startingIndentLevel : 0
		this.writeComments = setup.comments ? setup.comments : false
		// Internal state
		this.noTrailingSemicolon = false
	}
	
	write( string ) {
		this.output += string
	}

	writeToStream( string ) {
		this.output.write( string )
	}

	writeAndMap( string, location ) {
		this.output += string
		if ( location != null ) {
			this.map.add( this.sourceFile, location, this )
		}
		const { length } = string
		if ( length > 0 ) {
			if ( string.charCodeAt( string.length - 1 ) === 10 ) {
				this.line++
				this.column = 0
			} else {
				this.column += length
			}
		}
	}

	writeToStreamAndMap( string, location ) {
		this.output.write( string )
	}

	map( string ) {
		
	}

	toString() {
		return this.output
	}

}


class SourceMap {

	constructor() {

	}

	add( fileName, originalLocation, generatedLocation ) {

	}

}


export default function astring( node, options ) {
	/*
	Returns a string representing the rendered code of the provided AST `node`.
	The `options` are:

	- `indent`: string to use for indentation (defaults to `\t`)
	- `lineEnd`: string to use for line endings (defaults to `\n`)
	- `startingIndentLevel`: indent level to start from (default to `0`)
	- `comments`: generate comments if `true` (defaults to `false`)
	- `output`: output stream to write the rendered code to (defaults to `null`)
	- `generator`: custom code generator (defaults to `defaultGenerator`)
	*/
	const state = new State( options )
	// Travel through the AST node and generate the code
	state.generator[ node.type ]( node, state )
	return state.output
}
