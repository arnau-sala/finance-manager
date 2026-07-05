UPDATE "Transaction"
SET "categoryId" = CASE
    WHEN "type" = 'EXPENSE' THEN
        CASE "categoryId"
            WHEN 'expense-housing' THEN 'expense-housing'
            WHEN 'expense-groceries' THEN 'expense-groceries'
            WHEN 'expense-dining-out' THEN 'expense-bars-restaurants'
            WHEN 'expense-transportation' THEN 'expense-transportation'
            WHEN 'expense-healthcare' THEN 'expense-health'
            WHEN 'expense-education' THEN 'expense-education'
            WHEN 'expense-entertainment' THEN 'expense-parties'
            WHEN 'expense-shopping' THEN 'expense-shopping'
            WHEN 'expense-subscriptions' THEN 'expense-subscriptions'
            WHEN 'expense-travel' THEN 'expense-travel'
            WHEN 'expense-gifts-donations' THEN 'expense-gifts'
            ELSE 'expense-other'
        END
    ELSE
        CASE "categoryId"
            WHEN 'income-salary' THEN 'income-salary'
            WHEN 'income-freelance' THEN 'income-freelance'
            WHEN 'income-business' THEN 'income-sales'
            WHEN 'income-investments' THEN 'income-investments'
            WHEN 'income-benefits' THEN 'income-allowance'
            WHEN 'income-gifts' THEN 'income-gifts'
            ELSE 'income-other'
        END
END;

DELETE FROM "Category";

INSERT INTO "Category" ("id", "name", "type") VALUES
    ('expense-bars-restaurants', 'Bars & Restaurants', 'EXPENSE'),
    ('expense-education', 'Education', 'EXPENSE'),
    ('expense-gifts', 'Gifts', 'EXPENSE'),
    ('expense-groceries', 'Groceries', 'EXPENSE'),
    ('expense-health', 'Health', 'EXPENSE'),
    ('expense-housing', 'Housing', 'EXPENSE'),
    ('expense-parties', 'Parties', 'EXPENSE'),
    ('expense-shopping', 'Shopping', 'EXPENSE'),
    ('expense-sports', 'Sports', 'EXPENSE'),
    ('expense-subscriptions', 'Subscriptions', 'EXPENSE'),
    ('expense-transportation', 'Transportation', 'EXPENSE'),
    ('expense-travel', 'Travel', 'EXPENSE'),
    ('expense-other', 'Other', 'EXPENSE'),
    ('income-allowance', 'Allowance', 'INCOME'),
    ('income-freelance', 'Freelance', 'INCOME'),
    ('income-gifts', 'Gifts', 'INCOME'),
    ('income-investments', 'Investments', 'INCOME'),
    ('income-salary', 'Salary', 'INCOME'),
    ('income-sales', 'Sales', 'INCOME'),
    ('income-other', 'Other', 'INCOME');
