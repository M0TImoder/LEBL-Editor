use super::*;

impl Program {
    pub fn to_python(&self, config: RenderConfig) -> String {
        if config.mode == RenderMode::Lossless && !self.dirty && !self.raw_tokens.is_empty() {
            return render_lossless(&self.raw_tokens);
        }
        render_pretty(self, config)
    }
}

fn render_lossless(tokens: &[LexToken]) -> String {
    let mut output = String::new();
    for token in tokens {
        output.push_str(&token.raw);
    }
    output
}

struct PrettyContext<'a> {
    tokens: Option<&'a [Token]>,
    reuse_token_ranges: bool,
}

fn render_pretty(program: &Program, config: RenderConfig) -> String {
    let mut lines = Vec::new();
    let context = PrettyContext {
        tokens: if config.reuse_token_ranges {
            Some(&program.tokens)
        } else {
            None
        },
        reuse_token_ranges: config.reuse_token_ranges,
    };
    for stmt in &program.body {
        render_stmt(stmt, 0, program.indent_width, &mut lines, &context);
    }
    let output = lines.join("\n");
    if output.is_empty() {
        output
    } else {
        format!("{output}\n")
    }
}

fn render_stmt(
    stmt: &Stmt,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    if context.reuse_token_ranges {
        if let Some(tokens) = context.tokens {
            if let Some(rendered) = render_token_range(tokens, &stmt_meta(stmt).token_range) {
                for line in rendered.split('\n') {
                    lines.push(line.to_string());
                }
                return;
            }
        }
    }
    let prefix = indent_str(indent_level * indent_width);
    match stmt {
        Stmt::If(stmt) => {
            lines.push(format!(
                "{prefix}if {}:",
                render_expr(&stmt.condition, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
            for elif in &stmt.elifs {
                lines.push(format!(
                    "{prefix}elif {}:",
                    render_expr(&elif.condition, 0)
                ));
                render_block(&elif.body, indent_level + 1, indent_width, lines, context);
            }
            if let Some(body) = &stmt.else_body {
                lines.push(format!("{prefix}else:"));
                render_block(body, indent_level + 1, indent_width, lines, context);
            }
        }
        Stmt::While(stmt) => {
            lines.push(format!(
                "{prefix}while {}:",
                render_expr(&stmt.condition, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::For(stmt) => {
            lines.push(format!(
                "{prefix}for {} in {}:",
                render_expr(&stmt.target, 0),
                render_expr(&stmt.iterable, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::FunctionDef(stmt) => {
            let params = stmt.params.join(", ");
            lines.push(format!("{prefix}def {}({}):", stmt.name, params));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::Match(stmt) => {
            lines.push(format!(
                "{prefix}match {}:",
                render_expr(&stmt.subject, 0)
            ));
            render_case_block(&stmt.cases, indent_level + 1, indent_width, lines, context);
        }
        Stmt::Assign(stmt) => {
            lines.push(format!(
                "{prefix}{} = {}",
                render_expr(&stmt.target, 0),
                render_expr(&stmt.value, 0)
            ));
        }
        Stmt::Expr(stmt) => {
            lines.push(format!("{prefix}{}", render_expr(&stmt.expr, 0)));
        }
        Stmt::Pass(_) => {
            lines.push(format!("{prefix}pass"));
        }
        Stmt::Empty(_) => lines.push(String::new()),
    }
}

fn render_block(
    block: &Block,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    if block.statements.is_empty() {
        lines.push(format!("{}pass", indent_str(indent_level * indent_width)));
        return;
    }
    for stmt in &block.statements {
        render_stmt(stmt, indent_level, indent_width, lines, context);
    }
}

fn render_case_block(
    block: &CaseBlock,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    for case_stmt in &block.cases {
        let pattern = render_pattern(&case_stmt.pattern);
        lines.push(format!(
            "{}case {}:",
            indent_str(indent_level * indent_width),
            pattern
        ));
        render_block(&case_stmt.body, indent_level + 1, indent_width, lines, context);
    }
}

fn stmt_meta(stmt: &Stmt) -> &NodeMeta {
    match stmt {
        Stmt::If(stmt) => &stmt.meta,
        Stmt::While(stmt) => &stmt.meta,
        Stmt::For(stmt) => &stmt.meta,
        Stmt::Match(stmt) => &stmt.meta,
        Stmt::FunctionDef(stmt) => &stmt.meta,
        Stmt::Assign(stmt) => &stmt.meta,
        Stmt::Expr(stmt) => &stmt.meta,
        Stmt::Pass(stmt) => &stmt.meta,
        Stmt::Empty(stmt) => &stmt.meta,
    }
}

fn render_token_range(tokens: &[Token], range: &TokenRange) -> Option<String> {
    if range.start > range.end || range.end >= tokens.len() {
        return None;
    }
    let mut output = String::new();
    for token in &tokens[range.start..=range.end] {
        output.push_str(&render_token(token));
    }
    Some(output)
}

fn render_token(token: &Token) -> String {
    let mut output = String::new();
    for trivia in &token.leading_trivia {
        output.push_str(&render_trivia(trivia));
    }
    output.push_str(&token.raw);
    for trivia in &token.trailing_trivia {
        output.push_str(&render_trivia(trivia));
    }
    output
}

fn render_trivia(trivia: &Trivia) -> String {
    match &trivia.kind {
        TriviaKind::Comment(text) => format!("#{text}"),
        TriviaKind::RawWhitespace(text) => text.clone(),
        TriviaKind::Blank(_) => "\n".to_string(),
    }
}

fn render_pattern(pattern: &Pattern) -> String {
    match pattern {
        Pattern::Wildcard(_) => "_".to_string(),
        Pattern::Identifier(pattern) => pattern.name.clone(),
        Pattern::Literal(pattern) => render_literal(&pattern.literal),
    }
}

fn render_expr(expr: &Expr, parent_prec: u8) -> String {
    match expr {
        Expr::Identifier(expr) => expr.name.clone(),
        Expr::Literal(expr) => render_literal(&expr.literal),
        Expr::Grouped(expr) => match &*expr.expr {
            Expr::Comprehension(ComprehensionExpr::Generator(_)) => render_expr(&expr.expr, 0),
            _ => format!("({})", render_expr(&expr.expr, 0)),
        },
        Expr::Tuple(expr) => {
            if expr.elements.len() == 1 {
                format!("{},", render_expr(&expr.elements[0], 0))
            } else {
                expr.elements
                    .iter()
                    .map(|item| render_expr(item, 0))
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        }
        Expr::List(expr) => {
            let inner = expr
                .elements
                .iter()
                .map(|item| render_expr(item, 0))
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{inner}]")
        }
        Expr::Dict(expr) => {
            let inner = expr
                .entries
                .iter()
                .map(|entry| format!("{}: {}", render_expr(&entry.key, 0), render_expr(&entry.value, 0)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{inner}}}")
        }
        Expr::Set(expr) => {
            let inner = expr
                .elements
                .iter()
                .map(|item| render_expr(item, 0))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{inner}}}")
        }
        Expr::Comprehension(expr) => {
            let render_suffix = |fors: &[ComprehensionFor]| {
                let mut suffix = String::new();
                for comp in fors {
                    suffix.push_str(&format!(
                        " for {} in {}",
                        render_expr(&comp.target, 0),
                        render_expr(&comp.iter, 0)
                    ));
                    for condition in &comp.ifs {
                        suffix.push_str(&format!(" if {}", render_expr(condition, 0)));
                    }
                }
                suffix
            };
            match expr {
                ComprehensionExpr::List(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("[{}{suffix}]", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Set(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("{{{}{suffix}}}", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Generator(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("({}{suffix})", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Dict(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!(
                        "{{{}: {}{suffix}}}",
                        render_expr(&expr.key, 0),
                        render_expr(&expr.value, 0)
                    )
                }
            }
        }
        Expr::Attribute(expr) => {
            let prec = 9;
            wrap_if_needed(
                format!("{}.{}", render_expr(&expr.value, prec), expr.attr),
                prec,
                parent_prec,
            )
        }
        Expr::Subscript(expr) => {
            let prec = 9;
            wrap_if_needed(
                format!(
                    "{}[{}]",
                    render_expr(&expr.value, prec),
                    render_expr(&expr.index, 0)
                ),
                prec,
                parent_prec,
            )
        }
        Expr::Call(expr) => {
            let prec = 9;
            let callee = render_expr(&expr.callee, prec);
            let args = expr
                .args
                .iter()
                .map(|arg| render_expr(arg, 0))
                .collect::<Vec<_>>()
                .join(", ");
            let rendered = format!("{callee}({args})");
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Unary(expr) => {
            let prec = 8;
            let value = render_expr(&expr.expr, prec);
            let op = match expr.op {
                UnaryOp::Neg => "-",
                UnaryOp::Not => "not ",
            };
            wrap_if_needed(format!("{op}{value}"), prec, parent_prec)
        }
        Expr::BoolOp(expr) => {
            let prec = boolop_precedence(&expr.op);
            let op = match expr.op {
                BoolOp::And => "and",
                BoolOp::Or => "or",
            };
            let rendered = expr
                .values
                .iter()
                .map(|value| render_expr(value, prec + 1))
                .collect::<Vec<_>>()
                .join(&format!(" {op} "));
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Compare(expr) => {
            let prec = 4;
            let mut rendered = render_expr(&expr.left, prec + 1);
            for (op, comparator) in expr.ops.iter().zip(expr.comparators.iter()) {
                let op_str = match op {
                    CompareOp::Eq => "==",
                    CompareOp::NotEq => "!=",
                    CompareOp::Lt => "<",
                    CompareOp::LtEq => "<=",
                    CompareOp::Gt => ">",
                    CompareOp::GtEq => ">=",
                    CompareOp::In => "in",
                    CompareOp::NotIn => "not in",
                    CompareOp::Is => "is",
                    CompareOp::IsNot => "is not",
                };
                rendered.push_str(&format!(
                    " {op_str} {}",
                    render_expr(comparator, prec + 1)
                ));
            }
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::IfExpr(expr) => {
            let prec = 1;
            let body = render_expr(&expr.body, prec + 1);
            let condition = render_expr(&expr.condition, prec + 1);
            let else_body = render_expr(&expr.else_body, prec);
            wrap_if_needed(
                format!("{body} if {condition} else {else_body}"),
                prec,
                parent_prec,
            )
        }
        Expr::Lambda(expr) => {
            let prec = 0;
            let params = expr.params.join(", ");
            let body = render_expr(&expr.body, 0);
            let rendered = if params.is_empty() {
                format!("lambda: {body}")
            } else {
                format!("lambda {params}: {body}")
            };
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Binary(expr) => {
            let prec = binary_precedence(&expr.op);
            let left = render_expr(&expr.left, prec);
            let right = render_expr(&expr.right, prec + 1);
            let op = match expr.op {
                BinaryOp::Add => "+",
                BinaryOp::Sub => "-",
                BinaryOp::Mul => "*",
                BinaryOp::Div => "/",
                BinaryOp::Mod => "%",
            };
            wrap_if_needed(format!("{left} {op} {right}"), prec, parent_prec)
        }
    }
}

fn render_literal(literal: &Literal) -> String {
    match literal {
        Literal::Number(value) => value.raw.clone(),
        Literal::String(value) => value.raw.clone(),
        Literal::Bool(value) => {
            if *value {
                "True".to_string()
            } else {
                "False".to_string()
            }
        }
        Literal::None => "None".to_string(),
    }
}

fn binary_precedence(op: &BinaryOp) -> u8 {
    op.precedence()
}

fn boolop_precedence(op: &BoolOp) -> u8 {
    match op {
        BoolOp::Or => 2,
        BoolOp::And => 3,
    }
}

fn wrap_if_needed(rendered: String, prec: u8, parent_prec: u8) -> String {
    if prec < parent_prec {
        format!("({rendered})")
    } else {
        rendered
    }
}

fn indent_str(count: usize) -> String {
    " ".repeat(count)
}
