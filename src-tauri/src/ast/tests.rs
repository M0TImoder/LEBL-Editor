use super::*;

fn parse_with(version: PythonVersion, source: &str) -> Result<Program, ParseError> {
    Program::parse(
        source.to_string(),
        ParserConfig {
            features: FeatureSet::from_version(version),
        },
    )
}

fn pretty_roundtrip(source: &str) -> Result<Program, ParseError> {
    let program = parse_with(PythonVersion::Py310, source)?;
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    parse_with(PythonVersion::Py310, &rendered)
}

#[test]
fn lossless_roundtrip() {
    let source = "value = 1\n# comment\nif value:\n    pass\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Lossless,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn lossless_roundtrip_with_comments() {
    let source = "value = 1  # inline\n\n# leading\nif value:\n    # nested\n    pass\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Lossless,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn match_version_gate() {
    let source = "match value:\n    case 1:\n        pass\n";
    let result = parse_with(PythonVersion::Py39, source);
    assert!(result.is_err());
}

#[test]
fn pretty_roundtrip_match() {
    let source = "match value:\n    case 1:\n        pass\n";
    let program = pretty_roundtrip(source).unwrap();
    assert!(!program.body.is_empty());
}

#[test]
fn error_span_reported() {
    let source = "if :\n    pass\n";
    let result = parse_with(PythonVersion::Py310, source);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.span.start.line >= 1);
}

#[test]
fn comprehension_roundtrip_pretty() {
    let source = "values = [x for x in items if x > 1]\n";
    let program = pretty_roundtrip(source).unwrap();
    assert!(!program.body.is_empty());
}

#[test]
fn dict_set_generator_roundtrip() {
    let source =
        "data = {k: v for k in items}\nset_values = {x for x in items}\ngen = (x for x in items)\n";
    let program = pretty_roundtrip(source).unwrap();
    assert_eq!(program.body.len(), 3);
}

#[test]
fn ifexpr_lambda_roundtrip() {
    let source = "value = (lambda x: x + 1)(1 if flag else 2)\n";
    let program = pretty_roundtrip(source).unwrap();
    assert!(!program.body.is_empty());
}

#[test]
fn function_def_roundtrip() {
    let source = "def add(a, b):\n    pass\n";
    let program = pretty_roundtrip(source).unwrap();
    assert_eq!(program.body.len(), 1);
}

#[test]
fn ann_assign_roundtrip() {
    let source = "x: int\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn ann_assign_with_value_roundtrip() {
    let source = "x: int = 5\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn function_def_with_annotations_roundtrip() {
    let source = "def add(a: int, b: int) -> int:\n    pass\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn function_def_partial_annotations_roundtrip() {
    let source = "def greet(name: str, times):\n    pass\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn function_def_return_only_roundtrip() {
    let source = "def get_value() -> int:\n    pass\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn ann_assign_complex_type_roundtrip() {
    let source = "data: List[int] = []\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

fn expr_eq(left: &Expr, right: &Expr) -> bool {
    match (left, right) {
        (Expr::Grouped(left), _) => expr_eq(&left.expr, right),
        (_, Expr::Grouped(right)) => expr_eq(left, &right.expr),
        (Expr::Identifier(left), Expr::Identifier(right)) => left.name == right.name,
        (Expr::Literal(left), Expr::Literal(right)) => literal_eq(&left.literal, &right.literal),
        (Expr::Binary(left), Expr::Binary(right)) => {
            left.op == right.op
                && expr_eq(&left.left, &right.left)
                && expr_eq(&left.right, &right.right)
        }
        (Expr::Unary(left), Expr::Unary(right)) => left.op == right.op && expr_eq(&left.expr, &right.expr),
        (Expr::BoolOp(left), Expr::BoolOp(right)) => {
            left.op == right.op && expr_vec_eq(&left.values, &right.values)
        }
        (Expr::Compare(left), Expr::Compare(right)) => {
            left.ops == right.ops
                && expr_eq(&left.left, &right.left)
                && expr_vec_eq(&left.comparators, &right.comparators)
        }
        (Expr::Lambda(left), Expr::Lambda(right)) => left.params == right.params && expr_eq(&left.body, &right.body),
        (Expr::IfExpr(left), Expr::IfExpr(right)) => {
            expr_eq(&left.body, &right.body)
                && expr_eq(&left.condition, &right.condition)
                && expr_eq(&left.else_body, &right.else_body)
        }
        (Expr::Call(left), Expr::Call(right)) => {
            expr_eq(&left.callee, &right.callee) && expr_vec_eq(&left.args, &right.args)
        }
        (Expr::Tuple(left), Expr::Tuple(right)) => expr_vec_eq(&left.elements, &right.elements),
        (Expr::List(left), Expr::List(right)) => expr_vec_eq(&left.elements, &right.elements),
        (Expr::Set(left), Expr::Set(right)) => expr_vec_eq(&left.elements, &right.elements),
        (Expr::Dict(left), Expr::Dict(right)) => dict_entry_vec_eq(&left.entries, &right.entries),
        (Expr::Attribute(left), Expr::Attribute(right)) => {
            left.attr == right.attr && expr_eq(&left.value, &right.value)
        }
        (Expr::Subscript(left), Expr::Subscript(right)) => {
            expr_eq(&left.value, &right.value) && expr_eq(&left.index, &right.index)
        }
        (Expr::Comprehension(left), Expr::Comprehension(right)) => comp_eq(left, right),
        _ => false,
    }
}

fn expr_vec_eq(left: &[Expr], right: &[Expr]) -> bool {
    left.len() == right.len() && left.iter().zip(right.iter()).all(|(a, b)| expr_eq(a, b))
}

fn dict_entry_vec_eq(left: &[DictEntry], right: &[DictEntry]) -> bool {
    left.len() == right.len()
        && left
            .iter()
            .zip(right.iter())
            .all(|(a, b)| expr_eq(&a.key, &b.key) && expr_eq(&a.value, &b.value))
}

fn literal_eq(left: &Literal, right: &Literal) -> bool {
    match (left, right) {
        (Literal::Number(left), Literal::Number(right)) => left == right,
        (Literal::String(left), Literal::String(right)) => left == right,
        (Literal::Bool(left), Literal::Bool(right)) => left == right,
        (Literal::None, Literal::None) => true,
        _ => false,
    }
}

fn comp_eq(left: &ComprehensionExpr, right: &ComprehensionExpr) -> bool {
    match (left, right) {
        (ComprehensionExpr::List(left), ComprehensionExpr::List(right)) => {
            expr_eq(&left.element, &right.element) && comp_fors_eq(&left.fors, &right.fors)
        }
        (ComprehensionExpr::Set(left), ComprehensionExpr::Set(right)) => {
            expr_eq(&left.element, &right.element) && comp_fors_eq(&left.fors, &right.fors)
        }
        (ComprehensionExpr::Generator(left), ComprehensionExpr::Generator(right)) => {
            expr_eq(&left.element, &right.element) && comp_fors_eq(&left.fors, &right.fors)
        }
        (ComprehensionExpr::Dict(left), ComprehensionExpr::Dict(right)) => {
            expr_eq(&left.key, &right.key)
                && expr_eq(&left.value, &right.value)
                && comp_fors_eq(&left.fors, &right.fors)
        }
        _ => false,
    }
}

fn comp_fors_eq(left: &[ComprehensionFor], right: &[ComprehensionFor]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right.iter()).all(|(a, b)| {
            expr_eq(&a.target, &b.target) && expr_eq(&a.iter, &b.iter) && expr_vec_eq(&a.ifs, &b.ifs)
        })
}

#[test]
fn property_expr_roundtrip() {
    for seed in 1..20 {
        let expr = generate_expr(seed, 3);
        let expected = expr.clone();
        let stmt = Stmt::Expr(ExprStmt {
            meta: NodeMeta::default(),
            expr,
        });
        let program = Program {
            meta: NodeMeta::default(),
            indent_width: 4,
            body: vec![stmt],
            tokens: Vec::new(),
            raw_tokens: Vec::new(),
            dirty: true,
        };
        let rendered = program.to_python(RenderConfig {
            mode: RenderMode::Pretty,
            reuse_token_ranges: false,
        });
        let parsed = parse_with(PythonVersion::Py310, &rendered).unwrap();
        let parsed_expr = match &parsed.body[0] {
            Stmt::Expr(stmt) => &stmt.expr,
            _ => panic!("expected expression statement"),
        };
        assert!(expr_eq(&expected, parsed_expr));
    }
}

#[test]
fn fstring_roundtrip() {
    let source = "x = f\"hello {name}\"\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn fstring_lossless_roundtrip() {
    let source = "msg = f'result: {x + 1}'\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Lossless,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

#[test]
fn fstring_multiple_exprs() {
    let source = "print(f\"{a} and {b}\")\n";
    let program = parse_with(PythonVersion::Py310, source).unwrap();
    let rendered = program.to_python(RenderConfig {
        mode: RenderMode::Pretty,
        reuse_token_ranges: false,
    });
    assert_eq!(rendered, source);
}

fn generate_expr(seed: u64, depth: u8) -> Expr {
    let mut value = seed;
    let mut next = || {
        value = value.wrapping_mul(1664525).wrapping_add(1013904223);
        value
    };
    if depth == 0 {
        return Expr::Literal(LiteralExpr {
            meta: NodeMeta::default(),
            literal: Literal::Number(NumberLiteral {
                raw: (next() % 10).to_string(),
            }),
        });
    }
    match next() % 4 {
        0 => Expr::Identifier(IdentifierExpr {
            meta: NodeMeta::default(),
            name: format!("v{}", next() % 5),
        }),
        1 => Expr::Unary(UnaryExpr {
            meta: NodeMeta::default(),
            op: UnaryOp::Neg,
            expr: Box::new(generate_expr(next(), depth - 1)),
        }),
        2 => Expr::Binary(BinaryExpr {
            meta: NodeMeta::default(),
            left: Box::new(generate_expr(next(), depth - 1)),
            op: if next() % 2 == 0 {
                BinaryOp::Add
            } else {
                BinaryOp::Mul
            },
            right: Box::new(generate_expr(next(), depth - 1)),
        }),
        _ => Expr::Call(CallExpr {
            meta: NodeMeta::default(),
            callee: Box::new(Expr::Identifier(IdentifierExpr {
                meta: NodeMeta::default(),
                name: "fn".to_string(),
            })),
            args: vec![generate_expr(next(), depth - 1)],
            kwargs: vec![],
        }),
    }
}
