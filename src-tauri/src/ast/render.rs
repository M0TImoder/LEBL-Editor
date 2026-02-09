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
            if let Some(body) = &stmt.else_body {
                lines.push(format!("{prefix}else:"));
                render_block(body, indent_level + 1, indent_width, lines, context);
            }
        }
        Stmt::For(stmt) => {
            let async_prefix = if stmt.is_async { "async " } else { "" };
            lines.push(format!(
                "{prefix}{async_prefix}for {} in {}:",
                render_expr(&stmt.target, 0),
                render_expr(&stmt.iterable, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
            if let Some(body) = &stmt.else_body {
                lines.push(format!("{prefix}else:"));
                render_block(body, indent_level + 1, indent_width, lines, context);
            }
        }
        Stmt::FunctionDef(stmt) => {
            for decorator in &stmt.decorators {
                lines.push(format!("{prefix}@{}", render_expr(decorator, 0)));
            }
            let params = stmt.params.iter().map(|p| {
                let prefix = match p.kind {
                    ParamKind::Star => "*",
                    ParamKind::DoubleStar => "**",
                    ParamKind::Normal => "",
                };
                let name_part = format!("{}{}", prefix, p.name);
                let with_ann = if let Some(ref ann) = p.annotation {
                    format!("{}: {}", name_part, render_expr(ann, 0))
                } else {
                    name_part
                };
                if let Some(ref default) = p.default {
                    format!("{} = {}", with_ann, render_expr(default, 0))
                } else {
                    with_ann
                }
            }).collect::<Vec<_>>().join(", ");
            let async_prefix = if stmt.is_async { "async " } else { "" };
            if let Some(ref ret) = stmt.return_type {
                lines.push(format!("{prefix}{async_prefix}def {}({}) -> {}:", stmt.name, params, render_expr(ret, 0)));
            } else {
                lines.push(format!("{prefix}{async_prefix}def {}({}):", stmt.name, params));
            }
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::ClassDef(stmt) => {
            for decorator in &stmt.decorators {
                lines.push(format!("{prefix}@{}", render_expr(decorator, 0)));
            }
            if stmt.bases.is_empty() {
                lines.push(format!("{prefix}class {}:", stmt.name));
            } else {
                let bases = stmt.bases.iter().map(|b| render_expr(b, 0)).collect::<Vec<_>>().join(", ");
                lines.push(format!("{prefix}class {}({}):", stmt.name, bases));
            }
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
            let targets_str = stmt.targets.iter()
                .map(|t| render_expr(t, 0))
                .collect::<Vec<_>>()
                .join(", ");
            lines.push(format!(
                "{prefix}{} = {}",
                targets_str,
                render_expr(&stmt.value, 0)
            ));
        }
        Stmt::AugAssign(stmt) => {
            let op_str = match stmt.op {
                Operator::PlusAssign => "+=",
                Operator::MinusAssign => "-=",
                Operator::StarAssign => "*=",
                Operator::SlashAssign => "/=",
                Operator::PercentAssign => "%=",
                _ => "?=",
            };
            lines.push(format!(
                "{prefix}{} {} {}",
                render_expr(&stmt.target, 0),
                op_str,
                render_expr(&stmt.value, 0)
            ));
        }
        Stmt::Expr(stmt) => {
            lines.push(format!("{prefix}{}", render_expr(&stmt.expr, 0)));
        }
        Stmt::Pass(_) => {
            lines.push(format!("{prefix}pass"));
        }
        Stmt::Return(stmt) => {
            if let Some(value) = &stmt.value {
                lines.push(format!("{prefix}return {}", render_expr(value, 0)));
            } else {
                lines.push(format!("{prefix}return"));
            }
        }
        Stmt::Break(_) => {
            lines.push(format!("{prefix}break"));
        }
        Stmt::Continue(_) => {
            lines.push(format!("{prefix}continue"));
        }
        Stmt::Empty(_) => lines.push(String::new()),
        Stmt::Import(stmt) => {
            if stmt.is_from {
                let names_str: Vec<String> = stmt.names.iter().map(|n| {
                    if let Some(alias) = &n.alias {
                        format!("{} as {}", n.name, alias)
                    } else {
                        n.name.clone()
                    }
                }).collect();
                lines.push(format!("{prefix}from {} import {}", stmt.module, names_str.join(", ")));
            } else {
                if let Some(first) = stmt.names.first() {
                    if let Some(alias) = &first.alias {
                        lines.push(format!("{prefix}import {} as {}", stmt.module, alias));
                    } else {
                        lines.push(format!("{prefix}import {}", stmt.module));
                    }
                } else {
                    lines.push(format!("{prefix}import {}", stmt.module));
                }
            }
        }
        Stmt::Try(stmt) => {
            lines.push(format!("{prefix}try:"));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
            for handler in &stmt.handlers {
                match (&handler.exception_type, &handler.name) {
                    (Some(exc_type), Some(name)) => {
                        lines.push(format!(
                            "{prefix}except {} as {}:",
                            render_expr(exc_type, 0),
                            name
                        ));
                    }
                    (Some(exc_type), None) => {
                        lines.push(format!(
                            "{prefix}except {}:",
                            render_expr(exc_type, 0)
                        ));
                    }
                    _ => {
                        lines.push(format!("{prefix}except:"));
                    }
                }
                render_block(&handler.body, indent_level + 1, indent_width, lines, context);
            }
            if let Some(else_body) = &stmt.else_body {
                lines.push(format!("{prefix}else:"));
                render_block(else_body, indent_level + 1, indent_width, lines, context);
            }
            if let Some(finally_body) = &stmt.finally_body {
                lines.push(format!("{prefix}finally:"));
                render_block(finally_body, indent_level + 1, indent_width, lines, context);
            }
        }
        Stmt::With(stmt) => {
            let items_str = stmt.items.iter().map(|item| {
                if let Some(name) = &item.name {
                    format!("{} as {name}", render_expr(&item.context, 0))
                } else {
                    render_expr(&item.context, 0)
                }
            }).collect::<Vec<_>>().join(", ");
            let async_prefix = if stmt.is_async { "async " } else { "" };
            lines.push(format!("{prefix}{async_prefix}with {items_str}:"));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::Assert(stmt) => {
            if let Some(message) = &stmt.message {
                lines.push(format!(
                    "{prefix}assert {}, {}",
                    render_expr(&stmt.condition, 0),
                    render_expr(message, 0)
                ));
            } else {
                lines.push(format!(
                    "{prefix}assert {}",
                    render_expr(&stmt.condition, 0)
                ));
            }
        }
        Stmt::Raise(stmt) => {
            if let Some(exception) = &stmt.exception {
                lines.push(format!("{prefix}raise {}", render_expr(exception, 0)));
            } else {
                lines.push(format!("{prefix}raise"));
            }
        }
        Stmt::Del(stmt) => {
            lines.push(format!("{prefix}del {}", render_expr(&stmt.target, 0)));
        }
        Stmt::Global(stmt) => {
            lines.push(format!("{prefix}global {}", stmt.names.join(", ")));
        }
        Stmt::Nonlocal(stmt) => {
            lines.push(format!("{prefix}nonlocal {}", stmt.names.join(", ")));
        }
        Stmt::AnnAssign(stmt) => {
            if let Some(ref value) = stmt.value {
                lines.push(format!(
                    "{prefix}{}: {} = {}",
                    stmt.target,
                    render_expr(&stmt.annotation, 0),
                    render_expr(value, 0)
                ));
            } else {
                lines.push(format!(
                    "{prefix}{}: {}",
                    stmt.target,
                    render_expr(&stmt.annotation, 0)
                ));
            }
        }
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
        Stmt::ClassDef(stmt) => &stmt.meta,
        Stmt::Assign(stmt) => &stmt.meta,
        Stmt::AugAssign(stmt) => &stmt.meta,
        Stmt::Expr(stmt) => &stmt.meta,
        Stmt::Pass(stmt) => &stmt.meta,
        Stmt::Return(stmt) => &stmt.meta,
        Stmt::Break(stmt) => &stmt.meta,
        Stmt::Continue(stmt) => &stmt.meta,
        Stmt::Empty(stmt) => &stmt.meta,
        Stmt::Import(stmt) => &stmt.meta,
        Stmt::Try(stmt) => &stmt.meta,
        Stmt::With(stmt) => &stmt.meta,
        Stmt::Assert(stmt) => &stmt.meta,
        Stmt::Raise(stmt) => &stmt.meta,
        Stmt::Del(stmt) => &stmt.meta,
        Stmt::Global(stmt) => &stmt.meta,
        Stmt::Nonlocal(stmt) => &stmt.meta,
        Stmt::AnnAssign(stmt) => &stmt.meta,
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
            let prec = 13;
            wrap_if_needed(
                format!("{}.{}", render_expr(&expr.value, prec), expr.attr),
                prec,
                parent_prec,
            )
        }
        Expr::Subscript(expr) => {
            let prec = 13;
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
        Expr::Slice(expr) => {
            let lower = expr.lower.as_ref().map_or(String::new(), |e| render_expr(e, 0));
            let upper = expr.upper.as_ref().map_or(String::new(), |e| render_expr(e, 0));
            if let Some(step) = &expr.step {
                format!("{}:{}:{}", lower, upper, render_expr(step, 0))
            } else {
                format!("{}:{}", lower, upper)
            }
        }
        Expr::Call(expr) => {
            let prec = 13;
            let callee = render_expr(&expr.callee, prec);
            let args_parts: Vec<String> = expr
                .args
                .iter()
                .map(|arg| render_expr(arg, 0))
                .collect();
            let kwargs_parts: Vec<String> = expr
                .kwargs
                .iter()
                .map(|kw| format!("{}={}", kw.name, render_expr(&kw.value, 0)))
                .collect();
            let all_parts: Vec<&str> = args_parts.iter().chain(kwargs_parts.iter()).map(|s| s.as_str()).collect();
            let rendered = format!("{callee}({})", all_parts.join(", "));
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Unary(expr) => {
            let prec = 12;
            let value = render_expr(&expr.expr, prec);
            let op = match expr.op {
                UnaryOp::Neg => "-",
                UnaryOp::Not => "not ",
                UnaryOp::BitNot => "~",
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
                BinaryOp::FloorDiv => "//",
                BinaryOp::Power => "**",
                BinaryOp::BitAnd => "&",
                BinaryOp::BitOr => "|",
                BinaryOp::BitXor => "^",
                BinaryOp::LeftShift => "<<",
                BinaryOp::RightShift => ">>",
            };
            wrap_if_needed(format!("{left} {op} {right}"), prec, parent_prec)
        }
        Expr::FString(expr) => {
            let q = match expr.quote {
                QuoteStyle::Double => '"',
                QuoteStyle::Single => '\'',
            };
            let mut out = format!("f{q}");
            for part in &expr.parts {
                match part {
                    FStringPart::Literal(s) => out.push_str(s),
                    FStringPart::Expr(e) => {
                        out.push('{');
                        out.push_str(&render_expr(e, 0));
                        out.push('}');
                    }
                }
            }
            out.push(q);
            out
        }
        Expr::NamedExpr(expr) => {
            format!("({} := {})", expr.name, render_expr(&expr.value, 0))
        }
        Expr::Yield(expr) => {
            match &expr.value {
                Some(v) => format!("yield {}", render_expr(v, 0)),
                None => "yield".to_string(),
            }
        }
        Expr::YieldFrom(expr) => {
            format!("yield from {}", render_expr(&expr.value, 0))
        }
        Expr::Await(expr) => {
            format!("await {}", render_expr(&expr.value, 0))
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
