# Whilers Codebase Analysis

## Project Overview
**Language:** Rust (2021 edition)  
**Total Source Files:** 18 Rust modules in src/src/  
**Total Lines of Code:** ~2,813 LOC  
**Type:** While programming language interpreter and IDE  

---

## 1. INTERNAL DATATYPES FOR WHILE LANGUAGE VALUES

### Core Datatype: `NilTree` (from `src/niltree.rs`)

The fundamental internal representation of While language values is the **`NilTree` enum**:

```rust
#[derive(Debug, Eq, Clone)]
pub enum NilTree {
    Nil,                           // Empty/null value
    List(Arc<Vec<NilTree>>),       // Immutable list (uses Arc for sharing)
    Num(usize),                    // Non-negative integer
}
```

#### Key Characteristics:
- **Nil variant**: Represents empty list, zero, or false
- **List variant**: Ordered collection of NilTree values (wrapped in Arc for efficient memory sharing)
- **Num variant**: Non-negative integers (stored as `usize`)

#### Important Methods:
- `hd()`: Get head (last element of list, or nil if empty)
- `tl()`: Get tail (all but last element)
- `as_bool()`: Convert to boolean (Nil/0/empty = false, else = true)
- `cons(a, b)`: Cons operation (see below)

#### Construction Helper:
```rust
impl NilTree {
    pub fn list(v: Vec<NilTree>) -> NilTree {
        NilTree::List(Arc::new(v))
    }
}
```

#### Custom Equality:
NilTree implements special equality where:
- `Nil` equals empty list `[]` and integer `0`
- `Num(n)` can equal a list of n nils
- Allows cross-type comparisons (nil/0/false are all equivalent)

---

## 2. HOW LISTS ARE REPRESENTED

### Lists of Numbers and Lists of Lists of Numbers

#### Number Representation in NilTree:
- **Integer n**: Represented as `NilTree::List([nil; n])` (a list of n nils)
  - 0 → `Nil`
  - 1 → `List([nil])` (one element)
  - 3 → `List([nil, nil, nil])` (three elements)
  
  Alternative: `NilTree::Num(n)` directly stores the number

#### List of Numbers [a, b, c]:
Uses **cons cell structure** built with nested calls:
```
cons(a, cons(b, cons(c, nil)))
```
Which creates: `List([c, b, a])` (reversed, with head at the end)

#### Nested Lists of Numbers [[a,b], [c,d]]:
```
cons(cons(a, cons(b, nil)), cons(cons(c, cons(d, nil)), nil))
```

### The Cons Operation

```rust
pub fn cons(a: &NilTree, b: &NilTree) -> NilTree {
    match (a, b) {
        (NilTree::Nil, NilTree::Nil) => NilTree::Num(1),
        (a, NilTree::List(v)) => {
            let mut v = (**v).clone();
            v.push(a.clone());
            NilTree::list(v)  // Append a to end of list
        }
        (NilTree::Nil, NilTree::Num(n)) => NilTree::Num(n + 1),
        (a, NilTree::Num(n)) => {
            let mut v = vec![NilTree::Nil; n + 1];
            v[*n] = a.clone();
            NilTree::list(v)  // Create list with a at position n
        }
        (a, NilTree::Nil) => NilTree::list(vec![a.clone()]),  // Single element list
    }
}
```

### Display Format (Tree Notation)
NilTree displays in nested angle-bracket notation:
- `nil` → `nil`
- `[a, b, c]` → `<a.<b.<c.nil>>>`
- Single cons: `<a.nil>`

---

## 3. PARSING AND CONVERSION FUNCTIONS

### Main Parser Entry Point: `parser.rs`

#### Core Parse Function:
```rust
pub fn parse(s: &str) -> anyhow::Result<Prog>
```
- Uses **nom parser combinator library** for parsing
- Returns AST `Prog` (Program) structure

#### Supported Input Formats:

**Numeric Literals:**
- `5` → `Expression::Num(5)`

**List Syntax:**
- `[1, 2, 3]` → `Expression::List([Num(1), Num(2), Num(3)])`

**Cons Syntax:**
- `cons nil X` → `Expression::Cons(Nil, Var(X))`

**Operators:**
- `hd X` → `Expression::Hd(Var(X))`
- `tl X` → `Expression::Tl(Var(X))`

**Boolean/Nil:**
- `nil` → `Expression::Nil`
- `true` → `Expression::Cons(Nil, Nil)`
- `false` → `Expression::Nil`

**Atoms (Programs-as-Data):**
- `@cons`, `@hd`, `@tl`, `@:=` → Mapped to numeric atoms

**Tree Literals:**
- `<nil.nil>` → `Expression::Cons(Nil, Nil)`

### Expression Parsing (from `parser.rs`):
```rust
pub fn expression(s: &str) -> IResult<&str, Expression, VerboseError<&str>>
pub fn non_equality_expression(s: &str) -> IResult<&str, Expression, VerboseError<&str>>
pub fn list_expr(s: &str) -> IResult<&str, Expression, VerboseError<&str>>
pub fn name(s: &str) -> IResult<&str, &str, VerboseError<&str>>
```

### Conversion Functions: `extended_to_core.rs`

#### Number Encoding to Cons Cells:
```rust
pub fn num_to_core(n: usize) -> Expression {
    let mut res = Expression::Nil;
    for _ in 0..n {
        res = Expression::Cons(Box::new(Expression::Nil), Box::new(res));
    }
    res
}
// 3 → cons(nil, cons(nil, cons(nil, nil)))
```

#### Number Encoding to NilTree:
```rust
pub fn num_to_niltree(n: usize) -> NilTree {
    if n == 0 {
        NilTree::Nil
    } else {
        NilTree::list(vec![NilTree::Nil; n])
    }
}
// 3 → List([nil, nil, nil])
```

#### List to Cons Structure:
```rust
pub fn list_to_cons(list: &[Expression]) -> Expression {
    match list {
        [] => Expression::Nil,
        v => Expression::Cons(Box::new(v[0].clone()), list_to_cons(&v[1..]).into()),
    }
}
// [a, b, c] → cons(a, cons(b, cons(c, nil)))
```

#### Boolean Encoding:
```rust
pub fn bool_to_core(b: bool) -> Expression {
    match b {
        true => Expression::Cons(Box::new(Expression::Nil), Box::new(Expression::Nil)),
        false => Expression::Nil,
    }
}
```

#### Core Transformation:
```rust
pub fn expr_to_core(expr: &Expression) -> Expression
pub fn prog_to_core(prog: &Prog, progs: &IndexMap<ProgName, Prog>) -> anyhow::Result<Prog>
```
Converts extended While syntax to minimal core While

### Input Parsing: `interpret.rs`

```rust
pub fn input(s: &str, progs: &IndexMap<ProgName, Prog>) -> anyhow::Result<NilTree> {
    let s = replace_progs_as_data(s, progs)?;
    match expression(&s) {
        Ok((_, expr)) => Ok(eval(&expr, &ExecState::new(...))),
        Err(e) => bail!("Failed to parse input:\n{:?}", e),
    }
}
```

### Output Formatting: `output.rs`

```rust
#[derive(PartialEq, Eq, Clone, serde::Serialize, serde::Deserialize, Copy)]
pub enum OutputFormat {
    NilTree,                    // Display as nested angles: <a.<b.nil>>
    Integer,                    // Parse as number
    ListOfIntegers,             // Format as [a,b,c]
    NestedListOfIntegers,       // Recursive list formatting
    NestedListOfAtoms,          // Replace numbers with atoms
    ProgramAsData,              // Show program as data structure
    CoreWhile,                  // Show core While form
}

pub fn format_list_ints(tree: &NilTree) -> String { ... }
pub fn format_nest_list_ints(tree: &NilTree) -> String { ... }
pub fn format_nest_list_atoms(tree: &NilTree) -> String { ... }
pub fn parse_num(tree: &NilTree) -> anyhow::Result<usize> { ... }
```

---

## 4. TEST INFRASTRUCTURE

### Test Framework
- **Framework**: Rust built-in `#[test]` with `#[cfg(test)]` modules
- **Test Runner**: `cargo test`
- **Assertion Style**: Standard Rust `assert_eq!`, `assert!`

### Test Files and Locations

#### Parser Tests: `parser.rs` (5 tests)
Location: `/workspaces/development/uni/2025-report/whilers/src/src/parser.rs:347-509`

```rust
#[test]
fn test_prog() { ... }              // Parses add.while correctly

#[test]
fn test_switch1() { ... }           // Switch statement parsing

#[test]
fn test_switch2() { ... }           // Switch with multiple statements

#[test]
fn test_switch3() { ... }           // Complex switch with conditionals

#[test]
fn test_brackets() { ... }          // Performance test for deep brackets

#[test]
fn test_stack_overflow() { ... }    // Handles 1M element comparison
```

#### Interpreter Tests: `interpret.rs` (5 tests)
Location: `/workspaces/development/uni/2025-report/whilers/src/src/interpret.rs:227-379`

```rust
#[test]
pub fn test_add() { ... }           // Tests: parse add.while, input [3,4], verify output 7

#[test]
pub fn test_switch1() { ... }       // Tests switch with numeric inputs (3, 4, 0)

#[test]
pub fn test_switch2() { ... }       // Tests switch with multiple cases

#[test]
fn test_equalg() { ... }            // Tests equality program with nested lists

#[test]
fn test_program_file_runs_and_reports_diagnostics() { ... }
                                    // Comprehensive test of test.while with full diagnostics
```

#### Prog-as-Data Tests: `prog_as_data.rs` (1 test)
Location: `/workspaces/development/uni/2025-report/whilers/src/src/prog_as_data.rs:81-94`

```rust
#[test]
fn test_unparse_simple_eq() { ... }  // Tests unparsing of simple_eq.while
```

### Example Programs (Used in Tests)
- `programs/add.while` - Addition program (main test fixture)
- `programs/switch1.while`, `switch2.while`, `switch3.while` - Switch statement examples
- `programs/equalG.while` - Equality comparison program
- `programs/simple_eq.while` - Simple equality test
- `programs/brackets.while` - Performance test with deep nesting
- `programs/test.while` - Complex test program
- `programs/prog.while` - Basic program example

### Running Tests
```bash
cargo test                          # Run all tests
cargo test --lib                    # Run library tests only
cargo test test_add                 # Run specific test
cargo test -- --nocapture          # Show print output
```

---

## 5. SRC/ DIRECTORY STRUCTURE

### Core Modules (18 files, ~2,813 LOC)

#### **niltree.rs** (110 LOC)
Core data structure and operations
- `NilTree` enum definition
- `cons()`, `hd()`, `tl()` operations
- Display formatting
- Equality implementation

#### **lang.rs** (162 LOC)
Language AST definitions
- `Prog` struct (program structure)
- `Block` struct (statement blocks)
- `Statement` enum (Assign, While, If, Macro, Switch)
- `Expression` enum (Cons, Hd, Tl, Nil, Var, Num, Bool, List, Eq)
- `ProgName`, `VarName` wrappers
- Display implementations for all types

#### **parser.rs** (509 LOC)
Parsing While programs from text
- Entry point: `parse()` function
- nom parser combinators
- Statement parsing: assign, while, if, switch, macro
- Expression parsing with full operator support
- Comment removal
- All test infrastructure

#### **interpret.rs** (380 LOC)
Program execution engine
- `interpret()` - main execution entry
- `eval()` - expression evaluation
- `ExecState` - execution state with macro stack
- `input()` - parse input to NilTree
- Test infrastructure

#### **extended_to_core.rs** (453 LOC)
Conversion to minimal While core
- `prog_to_core()` - full program conversion
- `num_to_core()`, `num_to_niltree()` - number encoding
- `list_to_cons()` - list encoding
- `expr_to_core()`, `stmt_to_core()` - expression/statement conversion
- `switch_to_ifs()` - switch to if conversion
- Macro expansion system

#### **output.rs** (182 LOC)
Output formatting and conversion
- `OutputFormat` enum (7 output formats)
- `generate_output()` - main output function
- Formatting functions: `format_list_ints()`, `format_nest_list_ints()`, `format_nest_list_atoms()`
- `parse_num()` - parse NilTree to number

#### **prog_as_data.rs** (94 LOC)
Program serialization to data
- `unparse_prog()` - convert program to data representation
- `unparse_core_prog()`, `unparse_block()`, `unparse_stmt()`, `unparse_expr()`
- Atom integration for data representation

#### **atoms.rs** (98 LOC)
Atom encoding for Programs-as-Data
- `Atom` enum with numeric representations (using prime numbers)
- Conversion: string → number, number → string
- Supported atoms: @:=, @asng, @while, @if, @hd, @tl, @cons, etc.

#### **variables.rs** (106 LOC)
Variable name tracking and generation
- `VarName` wrapper struct
- `Variables` tracker for program variables
- Variable renaming/generation functions

#### **editor.rs** (343 LOC)
GUI/Editor integration
- egui-based editor UI
- Syntax highlighting integration
- File handling

#### **app.rs** (27 LOC)
Application state management

#### **cli.rs** (60 LOC)
Command-line interface with clap

#### **highlight.rs** (93 LOC)
Syntax highlighting support

#### **main.rs** (47 LOC)
CLI entry point

#### **web.rs** (31 LOC)
WebAssembly support

#### **lib.rs** (18 LOC)
Library root, module exports

#### **utils.rs** (3 LOC)
Utility functions (indentation, etc.)

### Binary Targets
- **bin/niltree_values.rs** - Standalone NilTree utility
- **main** (src/main.rs) - Main CLI application
- **cli** (src/cli.rs) - CLI interface

### Build Configuration
- **build.rs** - Build script
- **Cargo.toml** - Manifest with dependencies:
  - nom (parser combinators)
  - anyhow (error handling)
  - indexmap (ordered maps)
  - egui/eframe (GUI)
  - regex (pattern matching)
  - serde (serialization)

---

## SUMMARY TABLE: DATATYPE REPRESENTATIONS

| Concept | Internal Type | While Syntax | Display Format |
|---------|---------------|--------------|----------------|
| Zero | `Nil` | `0` or `nil` | `nil` |
| Number n | `List([nil; n])` | `n` | `nil` (if 0) or `<nil.<nil..>>` |
| Empty list | `Nil` | `[]` or `nil` | `nil` |
| [a,b,c] | cons(a,cons(b,cons(c,nil))) | `[a,b,c]` or `cons a (cons b (cons c nil))` | `<a.<b.<c.nil>>>` |
| [[a,b],[c,d]] | nested cons | `[[a,b],[c,d]]` | `<<a.<b.nil>>.<c.<d.nil>>>` |
| true | `Num(1)` | `true` | `<nil.nil>` |
| false | `Nil` | `false` | `nil` |
