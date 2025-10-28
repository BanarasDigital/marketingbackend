import path from "path";
import { fileURLToPath } from "url";

const localFilePath = () => {
  const __filename = fileURLToPath(import.meta.url);
  const _dirname = path.dirname(_filename);
  return __dirname;
};
export { localFilePath };