import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { z } from "zod";

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

export const searchEntities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = SearchQuerySchema.parse(req.query);
    const supabase = createSupabaseServerClient(req, res);

    // Search stores
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name, city")
      .or(`id.ilike.%${q}%,name.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(5);

    // Search cases
    const { data: cases } = await supabase
      .from("complaints")
      .select("id, complaint_id, summary, store_id")
      .or(`complaint_id.ilike.%${q}%,summary.ilike.%${q}%`)
      .limit(5);

    // Search fraud
    const { data: fraud } = await supabase
      .from("fraud_reviews")
      .select("id, customer_name, confidence_score")
      .or(`customer_name.ilike.%${q}%`)
      .limit(5);

    res.status(200).json({
      stores: stores || [],
      cases: cases || [],
      fraud: fraud || [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid search query" });
      return;
    }
    next(error);
  }
};
