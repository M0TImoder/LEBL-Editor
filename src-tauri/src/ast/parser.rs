use super::*;
use super::lexer::{attach_trivia, insert_indent_tokens, Lexer};
use serde::{Deserialize, Serialize};

impl Program {
    pub fn parse(source: String, config: ParserConfig) -> Result<Self, ParseError> {
        let mut lexer = Lexer::new(source);
        let lexed = lexer.lex()?;
        let raw_tokens = lexed.tokens.clone();
        let tokens = attach_trivia(insert_indent_tokens(lexed.tokens));
        let mut parser = Parser::new(tokens.clone(), config, lexed.indent_width);
        let mut program = parser.parse_program()?;
        program.tokens = tokens;
        program.raw_tokens = raw_tokens;
        Ok(program)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
enum Associativity {
    Left,
    Right,
}

#[derive(Debug, Clone)]
struct BinaryOpInfo {
    op: BinaryOp,
    precedence: u8,
    assoc: Associativity,
}

struct Parser {
    tokens: Vec<Token>,
    index: usize,
    next_id: u64,
    config: ParserConfig,
    indent_width: usize,
    last_span: Span,
}

impl Parser {
    fn new(tokens: Vec<Token>, config: ParserConfig, indent_width: usize) -> Self {
        let last_span = tokens.last().map(|token| token.span).unwrap_or_default();
        Self {
            tokens,
            index: 0,
            next_id: 1,
            config,
            indent_width,
            last_span,
        }
    }

    fn parse_program(&mut self) -> Result<Program, ParseError> {
        let start = self.index;
        let mut body = Vec::new();
        while !self.check_tag(TokenTag::Eof) {
            if self.check_tag(TokenTag::Newline) {
                if self.peek_kind_offset(1).tag() == TokenTag::Eof {
                    self.advance();
                    break;
                }
                let newline_index = self.index;
                self.advance();
                let meta = self.node_meta(newline_index, newline_index);
                body.push(Stmt::Empty(EmptyStmt {
                    meta,
                    source: BlankSource::Source,
                }));
                continue;
            }
            body.push(self.parse_stmt()?);
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Program {
            meta,
            indent_width: self.indent_width,
            body,
            tokens: Vec::new(),
            raw_tokens: Vec::new(),
            dirty: false,
        })
    }

    fn parse_stmt(&mut self) -> Result<Stmt, ParseError> {
        match self.peek_kind() {
            TokenKind::Keyword(Keyword::If) => self.parse_if_stmt(),
            TokenKind::Keyword(Keyword::While) => self.parse_while_stmt(),
            TokenKind::Keyword(Keyword::For) => self.parse_for_stmt(),
            TokenKind::Keyword(Keyword::Match) => self.parse_match_stmt(),
            TokenKind::Keyword(Keyword::Def) => self.parse_function_def(),
            TokenKind::Keyword(Keyword::Class) => self.parse_class_def(),
            TokenKind::Keyword(Keyword::Pass) => self.parse_pass_stmt(),
            TokenKind::Keyword(Keyword::Return) => self.parse_return_stmt(),
            TokenKind::Keyword(Keyword::Break) => self.parse_break_stmt(),
            TokenKind::Keyword(Keyword::Continue) => self.parse_continue_stmt(),
            TokenKind::Keyword(Keyword::Import) => self.parse_import_stmt(),
            TokenKind::Keyword(Keyword::From) => self.parse_from_import_stmt(),
            TokenKind::Keyword(Keyword::Try) => self.parse_try_stmt(),
            TokenKind::Keyword(Keyword::Elif) | TokenKind::Keyword(Keyword::Else) => {
                Err(self.error("elif/else must follow if"))
            }
            TokenKind::Keyword(Keyword::Case) => Err(self.error("case outside match")),
            TokenKind::Keyword(Keyword::Except) | TokenKind::Keyword(Keyword::Finally) => {
                Err(self.error("except/finally must follow try"))
            }
            _ => self.parse_simple_stmt(),
        }
    }

    fn parse_pass_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Pass)?;
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Pass(PassStmt { meta }))
    }

    fn parse_return_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Return)?;
        let value = if self.check_tag(TokenTag::Newline) || self.check_tag(TokenTag::Eof) || self.check_tag(TokenTag::Dedent) {
            None
        } else {
            Some(self.parse_expression()?)
        };
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Return(ReturnStmt { meta, value }))
    }

    fn parse_break_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Break)?;
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Break(BreakStmt { meta }))
    }

    fn parse_continue_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Continue)?;
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Continue(ContinueStmt { meta }))
    }

    fn parse_import_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Import)?;
        let module = self.parse_dotted_name()?;
        let mut alias = None;
        if self.match_keyword(Keyword::As) {
            alias = Some(self.expect_identifier()?);
        }
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        let names = if alias.is_some() {
            vec![ImportName { name: module.clone(), alias }]
        } else {
            vec![]
        };
        Ok(Stmt::Import(ImportStmt { meta, module, names, is_from: false }))
    }

    fn parse_from_import_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::From)?;
        let module = self.parse_dotted_name()?;
        self.expect_keyword(Keyword::Import)?;
        let mut names = Vec::new();
        loop {
            let name = self.expect_identifier()?;
            let alias = if self.match_keyword(Keyword::As) {
                Some(self.expect_identifier()?)
            } else {
                None
            };
            names.push(ImportName { name, alias });
            if !self.match_tag(TokenTag::Comma) {
                break;
            }
        }
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Import(ImportStmt { meta, module, names, is_from: true }))
    }

    fn parse_dotted_name(&mut self) -> Result<String, ParseError> {
        let mut name = self.expect_identifier()?;
        while self.match_tag(TokenTag::Dot) {
            name.push('.');
            name.push_str(&self.expect_identifier()?);
        }
        Ok(name)
    }

    fn parse_simple_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        let expr = self.parse_expression()?;
        if self.match_operator(Operator::Assign) {
            let value = self.parse_expression_no_generator()?;
            self.expect_line_end()?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Stmt::Assign(AssignStmt {
                meta,
                target: expr,
                value,
            }));
        }
        if let Some(op) = self.try_aug_assign_op() {
            let value = self.parse_expression_no_generator()?;
            self.expect_line_end()?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Stmt::AugAssign(AugAssignStmt {
                meta,
                target: expr,
                op,
                value,
            }));
        }
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Expr(ExprStmt { meta, expr }))
    }

    fn parse_if_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::If)?;
        let condition = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let mut elifs = Vec::new();
        while self.match_keyword(Keyword::Elif) {
            let elif_start = self.index.saturating_sub(1);
            let elif_condition = self.parse_expression()?;
            self.expect_tag(TokenTag::Colon)?;
            let elif_body = self.parse_block()?;
            let meta = self.node_meta(elif_start, self.index.saturating_sub(1));
            elifs.push(ElifStmt {
                meta,
                condition: elif_condition,
                body: elif_body,
            });
        }
        let else_body = if self.match_keyword(Keyword::Else) {
            self.expect_tag(TokenTag::Colon)?;
            Some(self.parse_block()?)
        } else {
            None
        };
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::If(IfStmt {
            meta,
            condition,
            body,
            elifs,
            else_body,
        }))
    }

    fn parse_while_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::While)?;
        let condition = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::While(WhileStmt {
            meta,
            condition,
            body,
        }))
    }

    fn parse_for_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::For)?;
        let target = self.parse_expression()?;
        self.expect_keyword(Keyword::In)?;
        let iterable = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::For(ForStmt {
            meta,
            target,
            iterable,
            body,
        }))
    }

    fn parse_function_def(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Def)?;
        let name = self.expect_identifier()?;
        self.expect_tag(TokenTag::LParen)?;
        let mut params = Vec::new();
        if !self.check_tag(TokenTag::RParen) {
            loop {
                params.push(self.expect_identifier()?);
                if self.match_tag(TokenTag::Comma) {
                    if self.check_tag(TokenTag::RParen) {
                        break;
                    }
                    continue;
                }
                break;
            }
        }
        self.expect_tag(TokenTag::RParen)?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::FunctionDef(FunctionDefStmt {
            meta,
            name,
            params,
            body,
        }))
    }

    fn parse_class_def(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Class)?;
        let name = self.expect_identifier()?;
        let mut bases = Vec::new();
        if self.match_tag(TokenTag::LParen) {
            if !self.check_tag(TokenTag::RParen) {
                loop {
                    bases.push(self.parse_expression()?);
                    if self.match_tag(TokenTag::Comma) {
                        if self.check_tag(TokenTag::RParen) {
                            break;
                        }
                        continue;
                    }
                    break;
                }
            }
            self.expect_tag(TokenTag::RParen)?;
        }
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::ClassDef(ClassDefStmt {
            meta,
            name,
            bases,
            body,
        }))
    }

    fn parse_match_stmt(&mut self) -> Result<Stmt, ParseError> {
        if !self.config.features.match_stmt {
            return Err(self.error("match is disabled"));
        }
        let start = self.index;
        self.expect_keyword(Keyword::Match)?;
        let subject = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let cases = self.parse_case_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Match(MatchStmt {
            meta,
            subject,
            cases,
        }))
    }

    fn parse_try_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Try)?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let mut handlers = Vec::new();
        while self.match_keyword(Keyword::Except) {
            let handler_start = self.index.saturating_sub(1);
            let mut exception_type = None;
            let mut name = None;
            if !self.check_tag(TokenTag::Colon) {
                exception_type = Some(self.parse_expression()?);
                if self.match_keyword(Keyword::As) {
                    name = Some(self.expect_identifier()?);
                }
            }
            self.expect_tag(TokenTag::Colon)?;
            let handler_body = self.parse_block()?;
            let meta = self.node_meta(handler_start, self.index.saturating_sub(1));
            handlers.push(ExceptHandler {
                meta,
                exception_type,
                name,
                body: handler_body,
            });
        }
        let finally_body = if self.match_keyword(Keyword::Finally) {
            self.expect_tag(TokenTag::Colon)?;
            Some(self.parse_block()?)
        } else {
            None
        };
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Try(TryStmt {
            meta,
            body,
            handlers,
            finally_body,
        }))
    }

    fn parse_case_block(&mut self) -> Result<CaseBlock, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::Newline)?;
        let indent = self.expect_indent()?;
        let mut cases = Vec::new();
        while !self.check_tag(TokenTag::Dedent) && !self.check_tag(TokenTag::Eof) {
            if self.match_tag(TokenTag::Newline) {
                continue;
            }
            cases.push(self.parse_case_stmt()?);
        }
        self.expect_tag(TokenTag::Dedent)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(CaseBlock {
            meta,
            indent_level: indent,
            cases,
        })
    }

    fn parse_case_stmt(&mut self) -> Result<MatchCase, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Case)?;
        let pattern = self.parse_pattern()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(MatchCase { meta, pattern, body })
    }

    fn parse_pattern(&mut self) -> Result<Pattern, ParseError> {
        let start = self.index;
        let expr = self.parse_expression()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        match expr {
            Expr::Identifier(identifier) if identifier.name == "_" => {
                Ok(Pattern::Wildcard(meta))
            }
            Expr::Identifier(identifier) => Ok(Pattern::Identifier(PatternIdentifier {
                meta,
                name: identifier.name,
            })),
            Expr::Literal(literal) => Ok(Pattern::Literal(PatternLiteral {
                meta,
                literal: literal.literal,
            })),
            _ => Err(self.error("unsupported match pattern")),
        }
    }

    fn parse_block(&mut self) -> Result<Block, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::Newline)?;
        let mut pending_blank = Vec::new();
        while self.check_tag(TokenTag::Newline) {
            let newline_index = self.index;
            self.advance();
            pending_blank.push(newline_index);
        }
        let indent = self.expect_indent()?;
        let mut statements = Vec::new();
        for newline_index in pending_blank {
            let meta = self.node_meta(newline_index, newline_index);
            statements.push(Stmt::Empty(EmptyStmt {
                meta,
                source: BlankSource::Source,
            }));
        }
        while !self.check_tag(TokenTag::Dedent) && !self.check_tag(TokenTag::Eof) {
            if self.check_tag(TokenTag::Newline) {
                let newline_index = self.index;
                self.advance();
                let meta = self.node_meta(newline_index, newline_index);
                statements.push(Stmt::Empty(EmptyStmt {
                    meta,
                    source: BlankSource::Source,
                }));
                continue;
            }
            statements.push(self.parse_stmt()?);
        }
        self.expect_tag(TokenTag::Dedent)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Block {
            meta,
            indent_level: indent,
            statements,
        })
    }

    fn parse_expression(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(true, true)
    }

    fn parse_expression_no_generator(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(false, true)
    }

    fn parse_expression_no_if_expr(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(false, false)
    }

    fn parse_expression_with_generator(
        &mut self,
        allow_generator: bool,
        allow_if_expr: bool,
    ) -> Result<Expr, ParseError> {
        let start = self.index;
        let expr = self.parse_lambda_with_if_expr(allow_if_expr)?;
        if allow_generator && self.match_keyword(Keyword::For) {
            let fors = self.parse_comprehension_fors()?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Comprehension(ComprehensionExpr::Generator(
                ComprehensionGeneratorExpr {
                    meta,
                    element: Box::new(expr),
                    fors,
                },
            )));
        }
        Ok(expr)
    }

    fn parse_lambda_with_if_expr(&mut self, allow_if_expr: bool) -> Result<Expr, ParseError> {
        if self.match_keyword(Keyword::Lambda) {
            let start = self.index.saturating_sub(1);
            let mut params = Vec::new();
            if !self.check_tag(TokenTag::Colon) {
                loop {
                    params.push(self.expect_identifier()?);
                    if self.match_tag(TokenTag::Comma) {
                        if self.check_tag(TokenTag::Colon) {
                            break;
                        }
                        continue;
                    }
                    break;
                }
            }
            self.expect_tag(TokenTag::Colon)?;
            let body = self.parse_expression_with_generator(true, true)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Lambda(LambdaExpr {
                meta,
                params,
                body: Box::new(body),
            }));
        }
        self.parse_if_expr(allow_if_expr)
    }

    fn parse_if_expr(&mut self, allow_if_expr: bool) -> Result<Expr, ParseError> {
        let start = self.index;
        let body = self.parse_bool_or()?;
        if allow_if_expr && self.match_keyword(Keyword::If) {
            let condition = self.parse_bool_or()?;
            self.expect_keyword(Keyword::Else)?;
            let else_body = self.parse_if_expr(true)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::IfExpr(IfExpr {
                meta,
                body: Box::new(body),
                condition: Box::new(condition),
                else_body: Box::new(else_body),
            }));
        }
        Ok(body)
    }

    fn parse_bool_or(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let mut values = vec![self.parse_bool_and()?];
        while self.match_keyword(Keyword::Or) {
            values.push(self.parse_bool_and()?);
        }
        if values.len() == 1 {
            return Ok(values.remove(0));
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::BoolOp(BoolOpExpr {
            meta,
            op: BoolOp::Or,
            values,
        }))
    }

    fn parse_bool_and(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let mut values = vec![self.parse_compare()?];
        while self.match_keyword(Keyword::And) {
            values.push(self.parse_compare()?);
        }
        if values.len() == 1 {
            return Ok(values.remove(0));
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::BoolOp(BoolOpExpr {
            meta,
            op: BoolOp::And,
            values,
        }))
    }

    fn parse_compare(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let left = self.parse_binary(0)?;
        let mut ops = Vec::new();
        let mut comparators = Vec::new();
        while let Some(op) = self.take_compare_op() {
            ops.push(op);
            comparators.push(self.parse_binary(0)?);
        }
        if ops.is_empty() {
            return Ok(left);
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Compare(CompareExpr {
            meta,
            left: Box::new(left),
            ops,
            comparators,
        }))
    }

    fn parse_binary(&mut self, min_prec: u8) -> Result<Expr, ParseError> {
        let mut left = self.parse_unary()?;
        loop {
            let info = match self.peek_binary_op_info() {
                Some(info) => info,
                None => break,
            };
            if info.precedence < min_prec {
                break;
            }
            let op_meta_start = self.index;
            self.advance();
            let next_min = match info.assoc {
                Associativity::Left => info.precedence + 1,
                Associativity::Right => info.precedence,
            };
            let right = self.parse_binary(next_min)?;
            let meta = self.node_meta(op_meta_start, self.index.saturating_sub(1));
            left = Expr::Binary(BinaryExpr {
                meta,
                left: Box::new(left),
                op: info.op,
                right: Box::new(right),
            });
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, ParseError> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Minus) => {
                let start = self.index;
                self.advance();
                let expr = self.parse_unary()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Unary(UnaryExpr {
                    meta,
                    op: UnaryOp::Neg,
                    expr: Box::new(expr),
                }))
            }
            TokenKind::Keyword(Keyword::Not) => {
                let start = self.index;
                self.advance();
                let expr = self.parse_unary()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Unary(UnaryExpr {
                    meta,
                    op: UnaryOp::Not,
                    expr: Box::new(expr),
                }))
            }
            _ => self.parse_postfix(),
        }
    }

    fn parse_postfix(&mut self) -> Result<Expr, ParseError> {
        let mut expr = self.parse_primary()?;
        loop {
            if self.match_tag(TokenTag::LParen) {
                let start = self.index.saturating_sub(1);
                let mut args = Vec::new();
                let mut kwargs = Vec::new();
                if !self.check_tag(TokenTag::RParen) {
                    loop {
                        let arg_expr = self.parse_expression()?;
                        if let Expr::Identifier(ref ident) = arg_expr {
                            if self.match_operator(Operator::Assign) {
                                let value = self.parse_expression()?;
                                kwargs.push(KeywordArg {
                                    name: ident.name.clone(),
                                    value,
                                });
                            } else {
                                args.push(arg_expr);
                            }
                        } else {
                            args.push(arg_expr);
                        }
                        if self.match_tag(TokenTag::Comma) {
                            if self.check_tag(TokenTag::RParen) {
                                break;
                            }
                            continue;
                        }
                        break;
                    }
                }
                self.expect_tag(TokenTag::RParen)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Call(CallExpr {
                    meta,
                    callee: Box::new(expr),
                    args,
                    kwargs,
                });
                continue;
            }
            if self.match_tag(TokenTag::Dot) {
                let start = self.index.saturating_sub(1);
                let attr = self.expect_identifier()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Attribute(AttributeExpr {
                    meta,
                    value: Box::new(expr),
                    attr,
                });
                continue;
            }
            if self.match_tag(TokenTag::LBracket) {
                let start = self.index.saturating_sub(1);
                let index = self.parse_slice_or_expr()?;
                self.expect_tag(TokenTag::RBracket)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Subscript(SubscriptExpr {
                    meta,
                    value: Box::new(expr),
                    index: Box::new(index),
                });
                continue;
            }
            break;
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        match self.peek_kind() {
            TokenKind::Identifier(_) => {
                let name = self.expect_identifier()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Identifier(IdentifierExpr { meta, name }))
            }
            TokenKind::Number(_) => {
                let literal = self.expect_number()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr { meta, literal }))
            }
            TokenKind::String(_) => {
                let literal = self.expect_string()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr { meta, literal }))
            }
            TokenKind::FString(fstring) => {
                let fstring = fstring.clone();
                self.advance();
                let mut parts = Vec::new();
                for part in &fstring.parts {
                    match part {
                        FStringTokenPart::Literal(text) => {
                            parts.push(FStringPart::Literal(text.clone()));
                        }
                        FStringTokenPart::ExprText(text) => {
                            let expr = self.parse_fstring_expr(text)?;
                            parts.push(FStringPart::Expr(expr));
                        }
                    }
                }
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::FString(FStringExpr {
                    meta,
                    parts,
                    quote: fstring.quote,
                }))
            }
            TokenKind::Keyword(Keyword::True) => {
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::Bool(true),
                }))
            }
            TokenKind::Keyword(Keyword::False) => {
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::Bool(false),
                }))
            }
            TokenKind::Keyword(Keyword::None) => {
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::None,
                }))
            }
            TokenKind::LParen => {
                self.advance();
                let expr = self.parse_expression()?;
                if self.match_tag(TokenTag::Comma) {
                    let mut elements = vec![expr];
                    if !self.check_tag(TokenTag::RParen) {
                        loop {
                            elements.push(self.parse_expression_no_generator()?);
                            if self.match_tag(TokenTag::Comma) {
                                if self.check_tag(TokenTag::RParen) {
                                    break;
                                }
                                continue;
                            }
                            break;
                        }
                    }
                    self.expect_tag(TokenTag::RParen)?;
                    let meta = self.node_meta(start, self.index.saturating_sub(1));
                    return Ok(Expr::Tuple(TupleExpr { meta, elements }));
                }
                self.expect_tag(TokenTag::RParen)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Grouped(GroupedExpr {
                    meta,
                    expr: Box::new(expr),
                }))
            }
            TokenKind::LBracket => {
                self.advance();
                if self.match_tag(TokenTag::RBracket) {
                    let meta = self.node_meta(start, self.index.saturating_sub(1));
                    return Ok(Expr::List(ListExpr {
                        meta,
                        elements: Vec::new(),
                    }));
                }
                let first = self.parse_expression_no_generator()?;
                if self.match_tag(TokenTag::Comma) {
                    if self.check_tag(TokenTag::RBracket) {
                        self.expect_tag(TokenTag::RBracket)?;
                        let meta = self.node_meta(start, self.index.saturating_sub(1));
                        return Ok(Expr::List(ListExpr {
                            meta,
                            elements: vec![first],
                        }));
                    }
                    if self.match_keyword(Keyword::For) {
                        let fors = self.parse_comprehension_fors()?;
                        self.expect_tag(TokenTag::RBracket)?;
                        let meta = self.node_meta(start, self.index.saturating_sub(1));
                        return Ok(Expr::Comprehension(ComprehensionExpr::List(
                            ComprehensionListExpr {
                                meta,
                                element: Box::new(first),
                                fors,
                            },
                        )));
                    }
                    let mut elements = vec![first];
                    while self.match_tag(TokenTag::Comma) {
                        if self.check_tag(TokenTag::RBracket) {
                            break;
                        }
                        elements.push(self.parse_expression_no_generator()?);
                    }
                    self.expect_tag(TokenTag::RBracket)?;
                    let meta = self.node_meta(start, self.index.saturating_sub(1));
                    return Ok(Expr::List(ListExpr { meta, elements }));
                }
                if self.match_keyword(Keyword::For) {
                    let fors = self.parse_comprehension_fors()?;
                    self.expect_tag(TokenTag::RBracket)?;
                    let meta = self.node_meta(start, self.index.saturating_sub(1));
                    return Ok(Expr::Comprehension(ComprehensionExpr::List(
                        ComprehensionListExpr {
                            meta,
                            element: Box::new(first),
                            fors,
                        },
                    )));
                }
                let mut elements = vec![first];
                while self.match_tag(TokenTag::Comma) {
                    if self.check_tag(TokenTag::RBracket) {
                        break;
                    }
                    elements.push(self.parse_expression_no_generator()?);
                }
                self.expect_tag(TokenTag::RBracket)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::List(ListExpr { meta, elements }))
            }
            TokenKind::LBrace => self.parse_dict_or_set(),
            _ => Err(self.error("expected expression")),
        }
    }

    fn parse_dict_or_set(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        self.advance();
        if self.match_tag(TokenTag::RBrace) {
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Dict(DictExpr {
                meta,
                entries: Vec::new(),
            }));
        }
        let first = self.parse_expression_no_generator()?;
        if self.match_tag(TokenTag::Colon) {
            let value = self.parse_expression_no_generator()?;
            if self.match_keyword(Keyword::For) {
                let fors = self.parse_comprehension_fors()?;
                self.expect_tag(TokenTag::RBrace)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                return Ok(Expr::Comprehension(ComprehensionExpr::Dict(
                    ComprehensionDictExpr {
                        meta,
                        key: Box::new(first),
                        value: Box::new(value),
                        fors,
                    },
                )));
            }
            let mut entries = vec![DictEntry {
                meta: self.node_meta(start, self.index.saturating_sub(1)),
                key: first,
                value,
            }];
            while self.match_tag(TokenTag::Comma) {
                if self.check_tag(TokenTag::RBrace) {
                    break;
                }
                let entry_start = self.index;
                let key = self.parse_expression_no_generator()?;
                self.expect_tag(TokenTag::Colon)?;
                let entry_value = self.parse_expression_no_generator()?;
                entries.push(DictEntry {
                    meta: self.node_meta(entry_start, self.index.saturating_sub(1)),
                    key,
                    value: entry_value,
                });
            }
            self.expect_tag(TokenTag::RBrace)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Dict(DictExpr { meta, entries }));
        }
        if self.match_keyword(Keyword::For) {
            let fors = self.parse_comprehension_fors()?;
            self.expect_tag(TokenTag::RBrace)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Comprehension(ComprehensionExpr::Set(
                ComprehensionSetExpr {
                    meta,
                    element: Box::new(first),
                    fors,
                },
            )));
        }
        let mut elements = vec![first];
        while self.match_tag(TokenTag::Comma) {
            if self.check_tag(TokenTag::RBrace) {
                break;
            }
            elements.push(self.parse_expression_no_generator()?);
        }
        self.expect_tag(TokenTag::RBrace)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Set(SetExpr { meta, elements }))
    }

    fn parse_comprehension_fors(&mut self) -> Result<Vec<ComprehensionFor>, ParseError> {
        let mut fors = Vec::new();
        loop {
            let start = self.index.saturating_sub(1);
            let target = self.parse_assignment_target()?;
            self.expect_keyword(Keyword::In)?;
            let iter = self.parse_expression_no_if_expr()?;
            let mut ifs = Vec::new();
            while self.match_keyword(Keyword::If) {
                ifs.push(self.parse_expression_no_generator()?);
            }
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            fors.push(ComprehensionFor {
                meta,
                target,
                iter,
                ifs,
            });
            if self.match_keyword(Keyword::For) {
                continue;
            }
            break;
        }
        Ok(fors)
    }

    fn parse_assignment_target(&mut self) -> Result<Expr, ParseError> {
        self.parse_postfix()
    }

    fn peek_binary_op_info(&self) -> Option<BinaryOpInfo> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Plus) => Some(BinaryOpInfo {
                op: BinaryOp::Add,
                precedence: BinaryOp::Add.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Minus) => Some(BinaryOpInfo {
                op: BinaryOp::Sub,
                precedence: BinaryOp::Sub.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Star) => Some(BinaryOpInfo {
                op: BinaryOp::Mul,
                precedence: BinaryOp::Mul.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Slash) => Some(BinaryOpInfo {
                op: BinaryOp::Div,
                precedence: BinaryOp::Div.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Percent) => Some(BinaryOpInfo {
                op: BinaryOp::Mod,
                precedence: BinaryOp::Mod.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::FloorDiv) => Some(BinaryOpInfo {
                op: BinaryOp::FloorDiv,
                precedence: BinaryOp::FloorDiv.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Power) => Some(BinaryOpInfo {
                op: BinaryOp::Power,
                precedence: BinaryOp::Power.precedence(),
                assoc: Associativity::Right,
            }),
            _ => None,
        }
    }

    fn take_compare_op(&mut self) -> Option<CompareOp> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Eq) => {
                self.advance();
                Some(CompareOp::Eq)
            }
            TokenKind::Operator(Operator::NotEq) => {
                self.advance();
                Some(CompareOp::NotEq)
            }
            TokenKind::Operator(Operator::Lt) => {
                self.advance();
                Some(CompareOp::Lt)
            }
            TokenKind::Operator(Operator::LtEq) => {
                self.advance();
                Some(CompareOp::LtEq)
            }
            TokenKind::Operator(Operator::Gt) => {
                self.advance();
                Some(CompareOp::Gt)
            }
            TokenKind::Operator(Operator::GtEq) => {
                self.advance();
                Some(CompareOp::GtEq)
            }
            TokenKind::Keyword(Keyword::In) => {
                self.advance();
                Some(CompareOp::In)
            }
            TokenKind::Keyword(Keyword::Is) => {
                self.advance();
                if self.match_keyword(Keyword::Not) {
                    Some(CompareOp::IsNot)
                } else {
                    Some(CompareOp::Is)
                }
            }
            TokenKind::Keyword(Keyword::Not) => {
                if matches!(self.peek_kind_offset(1), TokenKind::Keyword(Keyword::In)) {
                    self.advance();
                    self.advance();
                    Some(CompareOp::NotIn)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    fn expect_tag(&mut self, tag: TokenTag) -> Result<Token, ParseError> {
        if self.check_tag(tag) {
            Ok(self.advance())
        } else {
            Err(self.error(format!("expected {:?}", tag)))
        }
    }

    fn expect_line_end(&mut self) -> Result<(), ParseError> {
        if self.match_tag(TokenTag::Newline) {
            return Ok(());
        }
        if self.check_tag(TokenTag::Dedent) {
            return Ok(());
        }
        if self.check_tag(TokenTag::Eof) {
            return Ok(());
        }
        Err(self.error("expected line end"))
    }

    fn expect_indent(&mut self) -> Result<usize, ParseError> {
        match self.peek_kind() {
            TokenKind::Indent { level } => {
                self.advance();
                if self.indent_width == 0 {
                    return Ok(level);
                }
                if level % self.indent_width != 0 {
                    return Err(self.error("invalid indent width"));
                }
                Ok(level / self.indent_width)
            }
            _ => Err(self.error("expected indent")),
        }
    }

    fn expect_identifier(&mut self) -> Result<String, ParseError> {
        match self.peek_kind() {
            TokenKind::Identifier(name) => {
                self.advance();
                Ok(name)
            }
            _ => Err(self.error("expected identifier")),
        }
    }

    fn expect_number(&mut self) -> Result<Literal, ParseError> {
        match self.peek_kind() {
            TokenKind::Number(literal) => {
                self.advance();
                Ok(Literal::Number(literal))
            }
            _ => Err(self.error("expected number")),
        }
    }

    fn expect_string(&mut self) -> Result<Literal, ParseError> {
        match self.peek_kind() {
            TokenKind::String(literal) => {
                self.advance();
                Ok(Literal::String(literal))
            }
            _ => Err(self.error("expected string")),
        }
    }

    fn parse_fstring_expr(&self, text: &str) -> Result<Expr, ParseError> {
        let mut lexer = Lexer::new(text.to_string());
        let lexed = lexer.lex()?;
        let tokens = attach_trivia(insert_indent_tokens(lexed.tokens));
        let mut sub_parser = Parser::new(tokens, self.config, self.indent_width);
        sub_parser.parse_expression()
    }

    fn expect_keyword(&mut self, keyword: Keyword) -> Result<(), ParseError> {
        match self.peek_kind() {
            TokenKind::Keyword(value) if value == keyword => {
                self.advance();
                Ok(())
            }
            _ => Err(self.error("expected keyword")),
        }
    }

    fn match_keyword(&mut self, keyword: Keyword) -> bool {
        match self.peek_kind() {
            TokenKind::Keyword(value) if value == keyword => {
                self.advance();
                true
            }
            _ => false,
        }
    }

    fn match_operator(&mut self, op: Operator) -> bool {
        match self.peek_kind() {
            TokenKind::Operator(value) if value == op => {
                self.advance();
                true
            }
            _ => false,
        }
    }

    fn try_aug_assign_op(&mut self) -> Option<Operator> {
        let ops = [
            Operator::PlusAssign,
            Operator::MinusAssign,
            Operator::StarAssign,
            Operator::SlashAssign,
            Operator::PercentAssign,
        ];
        for op in ops {
            if self.match_operator(op) {
                return Some(op);
            }
        }
        None
    }

    fn match_tag(&mut self, tag: TokenTag) -> bool {
        if self.check_tag(tag) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn check_tag(&self, tag: TokenTag) -> bool {
        self.peek_kind().tag() == tag
    }

    fn peek_kind(&self) -> TokenKind {
        self.tokens
            .get(self.index)
            .map(|token| token.kind.clone())
            .unwrap_or(TokenKind::Eof)
    }

    fn peek_kind_offset(&self, offset: usize) -> TokenKind {
        self.tokens
            .get(self.index.saturating_add(offset))
            .map(|token| token.kind.clone())
            .unwrap_or(TokenKind::Eof)
    }

    fn advance(&mut self) -> Token {
        let token = self.tokens[self.index].clone();
        self.index = self.index.saturating_add(1);
        self.last_span = token.span;
        token
    }

    fn error(&self, message: impl Into<String>) -> ParseError {
        let span = self
            .tokens
            .get(self.index)
            .map(|token| token.span)
            .unwrap_or(self.last_span);
        ParseError {
            message: message.into(),
            span,
        }
    }

    fn node_meta(&mut self, start: usize, end: usize) -> NodeMeta {
        let start_token = self.tokens.get(start);
        let end_token = self.tokens.get(end);
        let span = match (start_token, end_token) {
            (Some(start), Some(end)) => Span::join(start.span.start, end.span.end),
            (Some(start), None) => Span::join(start.span.start, start.span.end),
            _ => Span::default(),
        };
        let leading_trivia = start_token
            .map(|token| token.leading_trivia.clone())
            .unwrap_or_default();
        let trailing_trivia = end_token
            .map(|token| token.trailing_trivia.clone())
            .unwrap_or_default();
        let meta = NodeMeta {
            id: NodeId(self.next_id),
            span,
            token_range: TokenRange { start, end },
            leading_trivia,
            trailing_trivia,
        };
        self.next_id = self.next_id.saturating_add(1);
        meta
    }

    fn parse_slice_or_expr(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        if self.check_tag(TokenTag::Colon) {
            return self.parse_slice_from_colon(start, None);
        }
        let expr = self.parse_expression()?;
        if self.check_tag(TokenTag::Colon) {
            return self.parse_slice_from_colon(start, Some(expr));
        }
        Ok(expr)
    }

    fn parse_slice_from_colon(&mut self, start: usize, lower: Option<Expr>) -> Result<Expr, ParseError> {
        self.expect_tag(TokenTag::Colon)?;
        let upper = if !self.check_tag(TokenTag::Colon) && !self.check_tag(TokenTag::RBracket) {
            Some(Box::new(self.parse_expression()?))
        } else {
            None
        };
        let step = if self.match_tag(TokenTag::Colon) {
            if !self.check_tag(TokenTag::RBracket) {
                Some(Box::new(self.parse_expression()?))
            } else {
                None
            }
        } else {
            None
        };
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Slice(SliceExpr {
            meta,
            lower: lower.map(Box::new),
            upper,
            step,
        }))
    }
}
