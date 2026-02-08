use super::*;

pub(super) struct Lexer {
    source: Vec<char>,
    source_str: String,
    offset: usize,
    char_index: usize,
    line: usize,
    column: usize,
    paren_depth: usize,
    indent_width: Option<usize>,
    at_line_start: bool,
    line_has_content: bool,
    tokens: Vec<LexToken>,
}

pub(super) struct LexedSource {
    pub(super) tokens: Vec<LexToken>,
    pub(super) indent_width: usize,
}

impl Lexer {
    pub(super) fn new(source: String) -> Self {
        let chars: Vec<char> = source.chars().collect();
        Self {
            source: chars,
            source_str: source,
            offset: 0,
            char_index: 0,
            line: 1,
            column: 1,
            paren_depth: 0,
            indent_width: None,
            at_line_start: true,
            line_has_content: false,
            tokens: Vec::new(),
        }
    }

    pub(super) fn lex(&mut self) -> Result<LexedSource, ParseError> {
        while self.peek_char().is_some() {
            if self.at_line_start && self.paren_depth == 0 {
                self.lex_indent();
                self.at_line_start = false;
                self.line_has_content = false;
                if self.peek_char().is_none() {
                    break;
                }
            }
            let current = self.peek_char().unwrap();
            match current {
                '\n' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.paren_depth > 0 {
                        self.push_token(TokenKind::RawWhitespace("\n".to_string()), start);
                    } else {
                        if !self.line_has_content {
                            self.tokens.push(LexToken {
                                kind: TokenKind::Blank(BlankSource::Source),
                                span: Span::join(start, start),
                                raw: String::new(),
                            });
                        }
                        self.push_token(TokenKind::Newline, start);
                        self.at_line_start = true;
                    }
                }
                '#' => {
                    self.lex_comment();
                }
                ' ' | '\t' => {
                    self.lex_whitespace();
                }
                '0'..='9' => {
                    self.lex_number();
                }
                '"' | '\'' => {
                    self.lex_string()?;
                }
                'a'..='z' | 'A'..='Z' | '_' => {
                    self.lex_identifier();
                }
                '(' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LParen, start);
                }
                ')' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RParen, start);
                }
                '[' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LBracket, start);
                }
                ']' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RBracket, start);
                }
                '{' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LBrace, start);
                }
                '}' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RBrace, start);
                }
                '.' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Dot, start);
                }
                ':' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Colon, start);
                }
                ',' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Comma, start);
                }
                '=' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::Eq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Assign), start);
                    }
                }
                '!' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::NotEq), start);
                    } else {
                        return Err(self.error("unexpected character '!'"));
                    }
                }
                '<' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::LtEq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Lt), start);
                    }
                }
                '>' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::GtEq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Gt), start);
                    }
                }
                '+' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Plus), start);
                }
                '-' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Minus), start);
                }
                '*' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Star), start);
                }
                '/' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Slash), start);
                }
                '%' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Percent), start);
                }
                _ => {
                    return Err(self.error(format!("unexpected character '{current}'")));
                }
            }
        }
        let end = self.current_position();
        self.push_token(TokenKind::Eof, end);
        Ok(LexedSource {
            tokens: std::mem::take(&mut self.tokens),
            indent_width: self.indent_width.unwrap_or(4),
        })
    }

    fn lex_indent(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        let mut width = 0usize;
        while let Some(ch) = self.peek_char() {
            if ch == ' ' {
                raw.push(ch);
                width += 1;
                self.advance_char();
            } else if ch == '\t' {
                raw.push(ch);
                width += 4;
                self.advance_char();
            } else {
                break;
            }
        }
        if self.indent_width.is_none() && width > 0 {
            self.indent_width = Some(width);
        }
        self.push_token(TokenKind::Indentation(width), start);
    }

    fn lex_whitespace(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch == ' ' || ch == '\t' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        if !raw.is_empty() {
            self.push_token(TokenKind::RawWhitespace(raw), start);
        }
    }

    fn lex_comment(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch == '\n' {
                break;
            }
            raw.push(ch);
            self.advance_char();
        }
        let text = raw.trim_start_matches('#').to_string();
        self.push_token(TokenKind::Comment(text), start);
    }

    fn lex_number(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() || ch == '.' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        self.push_token(TokenKind::Number(NumberLiteral { raw }), start);
    }

    fn lex_string(&mut self) -> Result<(), ParseError> {
        let start = self.current_position();
        let quote = self.peek_char().unwrap();
        let quote_style = if quote == '"' {
            QuoteStyle::Double
        } else {
            QuoteStyle::Single
        };
        self.advance_char();
        let mut raw = String::new();
        raw.push(quote);
        let mut value = String::new();
        let mut escaped = false;
        let mut escaped_any = false;
        while let Some(ch) = self.peek_char() {
            if escaped {
                value.push(ch);
                raw.push(ch);
                escaped = false;
                self.advance_char();
                continue;
            }
            if ch == '\\' {
                escaped = true;
                escaped_any = true;
                raw.push(ch);
                self.advance_char();
                continue;
            }
            if ch == quote {
                raw.push(ch);
                self.advance_char();
                let literal = StringLiteral {
                    raw,
                    value,
                    quote: quote_style,
                    escaped: escaped_any,
                };
                self.push_token(TokenKind::String(literal), start);
                return Ok(());
            }
            value.push(ch);
            raw.push(ch);
            self.advance_char();
        }
        Err(self.error("unterminated string"))
    }

    fn lex_identifier(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_alphanumeric() || ch == '_' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        let kind = match raw.as_str() {
            "if" => TokenKind::Keyword(Keyword::If),
            "elif" => TokenKind::Keyword(Keyword::Elif),
            "else" => TokenKind::Keyword(Keyword::Else),
            "while" => TokenKind::Keyword(Keyword::While),
            "for" => TokenKind::Keyword(Keyword::For),
            "in" => TokenKind::Keyword(Keyword::In),
            "is" => TokenKind::Keyword(Keyword::Is),
            "lambda" => TokenKind::Keyword(Keyword::Lambda),
            "def" => TokenKind::Keyword(Keyword::Def),
            "match" => TokenKind::Keyword(Keyword::Match),
            "case" => TokenKind::Keyword(Keyword::Case),
            "pass" => TokenKind::Keyword(Keyword::Pass),
            "and" => TokenKind::Keyword(Keyword::And),
            "or" => TokenKind::Keyword(Keyword::Or),
            "not" => TokenKind::Keyword(Keyword::Not),
            "True" => TokenKind::Keyword(Keyword::True),
            "False" => TokenKind::Keyword(Keyword::False),
            "None" => TokenKind::Keyword(Keyword::None),
            _ => TokenKind::Identifier(raw),
        };
        self.push_token(kind, start);
    }

    fn push_token(&mut self, kind: TokenKind, start: Position) {
        let is_content = !matches!(
            kind,
            TokenKind::RawWhitespace(_)
                | TokenKind::Comment(_)
                | TokenKind::Blank(_)
                | TokenKind::Indentation(_)
                | TokenKind::Newline
                | TokenKind::Eof
        );
        let end = self.current_position();
        let raw = self
            .source_str
            .get(start.offset..end.offset)
            .unwrap_or("")
            .to_string();
        self.tokens.push(LexToken {
            kind: kind.clone(),
            span: Span::join(start, end),
            raw,
        });
        if is_content {
            self.line_has_content = true;
        }
    }

    fn peek_char(&self) -> Option<char> {
        self.source.get(self.char_index).copied()
    }

    fn advance_char(&mut self) {
        if let Some(&ch) = self.source.get(self.char_index) {
            self.char_index += 1;
            self.offset += ch.len_utf8();
            if ch == '\n' {
                self.line += 1;
                self.column = 1;
            } else {
                self.column += 1;
            }
        }
    }

    fn consume_char(&mut self, target: char) -> bool {
        if self.peek_char() == Some(target) {
            self.advance_char();
            return true;
        }
        false
    }

    fn current_position(&self) -> Position {
        Position {
            line: self.line,
            column: self.column,
            offset: self.offset,
        }
    }

    fn error(&self, message: impl Into<String>) -> ParseError {
        ParseError {
            message: message.into(),
            span: Span::join(self.current_position(), self.current_position()),
        }
    }
}

pub(super) fn insert_indent_tokens(tokens: Vec<LexToken>) -> Vec<LexToken> {
    let mut output = Vec::new();
    let mut indent_stack = vec![0usize];
    let mut pending_indent: Option<(usize, Position, Position, String)> = None;
    for token in tokens {
        match token.kind {
            TokenKind::Indentation(level) => {
                pending_indent = Some((level, token.span.start, token.span.end, token.raw));
            }
            TokenKind::Newline => {
                if let Some((_level, start, end, raw)) = pending_indent.take() {
                    output.push(LexToken {
                        kind: TokenKind::RawWhitespace("".to_string()),
                        span: Span::join(start, end),
                        raw,
                    });
                }
                output.push(token);
            }
            TokenKind::Eof => {
                if let Some((_level, start, end, raw)) = pending_indent.take() {
                    output.push(LexToken {
                        kind: TokenKind::RawWhitespace("".to_string()),
                        span: Span::join(start, end),
                        raw,
                    });
                }
                while indent_stack.len() > 1 {
                    indent_stack.pop();
                    output.push(LexToken {
                        kind: TokenKind::Dedent { level: 0 },
                        span: token.span,
                        raw: String::new(),
                    });
                }
                output.push(token);
            }
            _ => {
                if let Some((level, start, end, raw)) = pending_indent.take() {
                    if !token.kind.is_trivia() && token.kind != TokenKind::Newline {
                        let current = *indent_stack.last().unwrap_or(&0);
                        if level > current && level > 0 {
                            indent_stack.push(level);
                            output.push(LexToken {
                                kind: TokenKind::Indent { level },
                                span: Span::join(start, end),
                                raw: String::new(),
                            });
                        } else if level < current {
                            while let Some(last) = indent_stack.last().copied() {
                                if level >= last {
                                    break;
                                }
                                indent_stack.pop();
                                output.push(LexToken {
                                    kind: TokenKind::Dedent { level },
                                    span: Span::join(start, end),
                                    raw: String::new(),
                                });
                            }
                        }
                        output.push(LexToken {
                            kind: TokenKind::RawWhitespace("".to_string()),
                            span: Span::join(start, end),
                            raw,
                        });
                    } else {
                        output.push(LexToken {
                            kind: TokenKind::RawWhitespace("".to_string()),
                            span: Span::join(start, end),
                            raw,
                        });
                    }
                }
                output.push(token);
            }
        }
    }
    output
}

pub(super) fn attach_trivia(raw_tokens: Vec<LexToken>) -> Vec<Token> {
    let mut tokens: Vec<Token> = Vec::new();
    let mut pending_leading: Vec<Trivia> = Vec::new();
    let mut line_has_token = false;
    let mut last_sig_index: Option<usize> = None;
    for token in raw_tokens {
        if token.kind.is_trivia() {
            let trivia = trivia_from_token(&token);
            if line_has_token {
                if let Some(idx) = last_sig_index {
                    tokens[idx].trailing_trivia.push(trivia);
                } else {
                    pending_leading.push(trivia);
                }
            } else {
                pending_leading.push(trivia);
            }
            continue;
        }
        if token.kind == TokenKind::Newline {
            tokens.push(Token {
                kind: token.kind,
                span: token.span,
                raw: token.raw,
                leading_trivia: Vec::new(),
                trailing_trivia: Vec::new(),
            });
            last_sig_index = Some(tokens.len() - 1);
            line_has_token = false;
            continue;
        }
        let leading = std::mem::take(&mut pending_leading);
        tokens.push(Token {
            kind: token.kind,
            span: token.span,
            raw: token.raw,
            leading_trivia: leading,
            trailing_trivia: Vec::new(),
        });
        last_sig_index = Some(tokens.len() - 1);
        let is_structural = matches!(
            tokens.last().map(|token| &token.kind),
            Some(TokenKind::Indent { .. })
                | Some(TokenKind::Dedent { .. })
                | Some(TokenKind::Newline)
        );
        line_has_token = !is_structural;
    }
    if !pending_leading.is_empty() {
        if let Some(last) = tokens.last_mut() {
            if last.kind == TokenKind::Eof {
                last.leading_trivia.extend(pending_leading);
            } else {
                last.trailing_trivia.extend(pending_leading);
            }
        }
    }
    tokens
}

fn trivia_from_token(token: &LexToken) -> Trivia {
    let kind = match &token.kind {
        TokenKind::Comment(text) => TriviaKind::Comment(text.clone()),
        TokenKind::RawWhitespace(text) => TriviaKind::RawWhitespace(text.clone()),
        TokenKind::Blank(source) => TriviaKind::Blank(source.clone()),
        TokenKind::Indentation(_) => TriviaKind::RawWhitespace(token.raw.clone()),
        _ => TriviaKind::RawWhitespace(token.raw.clone()),
    };
    Trivia {
        kind,
        span: token.span,
    }
}
