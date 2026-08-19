using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace NativeCapturer
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        static extern IntPtr GetDesktopWindow();

        [DllImport("user32.dll")]
        static extern IntPtr GetWindowDC(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern IntPtr ReleaseDC(IntPtr hWnd, IntPtr hDC);

        [DllImport("gdi32.dll")]
        static extern IntPtr CreateCompatibleDC(IntPtr hDC);

        [DllImport("gdi32.dll")]
        static extern IntPtr CreateCompatibleBitmap(IntPtr hDC, int nWidth, int nHeight);

        [DllImport("gdi32.dll")]
        static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);

        [DllImport("gdi32.dll")]
        static extern bool BitBlt(IntPtr hObject, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hObjectSource, int nXSrc, int nYSrc, int dwRop);

        [DllImport("gdi32.dll")]
        static extern bool StretchBlt(IntPtr hdcDest, int nXOriginDest, int nYOriginDest, int nWidthDest, int nHeightDest,
                                      IntPtr hdcSrc, int nXOriginSrc, int nYOriginSrc, int nWidthSrc, int nHeightSrc, int dwRop);

        [DllImport("gdi32.dll")]
        static extern int SetStretchBltMode(IntPtr hdc, int nStretchMode);

        [DllImport("gdi32.dll")]
        static extern bool DeleteDC(IntPtr hDC);

        [DllImport("gdi32.dll")]
        static extern bool DeleteObject(IntPtr hObject);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        const int SRCCOPY = 0x00CC0020;
        const int HALFTONE = 4;
        const int COLORONCOLOR = 3;

        const int SM_CXSCREEN = 0;
        const int SM_CYSCREEN = 1;

        static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }

            int width = GetSystemMetrics(SM_CXSCREEN);
            int height = GetSystemMetrics(SM_CYSCREEN);
            if (width <= 0) width = 1920;
            if (height <= 0) height = 1080;

            int targetFps = 30;
            int quality = 65;
            float scale = 0.5f; // e.g. 1920x1080 for 4K screen -> fast 60fps streaming

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--fps" && i + 1 < args.Length) int.TryParse(args[i + 1], out targetFps);
                if (args[i] == "--quality" && i + 1 < args.Length) int.TryParse(args[i + 1], out quality);
                if (args[i] == "--scale" && i + 1 < args.Length) float.TryParse(args[i + 1], out scale);
                if (args[i] == "--benchmark")
                {
                    RunBenchmark(width, height, quality, scale);
                    return;
                }
            }

            int outWidth = (int)(width * scale);
            int outHeight = (int)(height * scale);

            Console.Error.WriteLine($"[Capturer] Started: {width}x{height} -> {outWidth}x{outHeight} @ {targetFps} FPS (Q={quality}%)");

            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
            EncoderParameters encParams = new EncoderParameters(1);
            encParams.Param[0] = new EncoderParameter(Encoder.Quality, (long)quality);

            using var stdout = Console.OpenStandardOutput();
            using var ms = new MemoryStream(256 * 1024);
            byte[] header = new byte[8];

            var sw = Stopwatch.StartNew();
            long frameIntervalMs = 1000 / Math.Max(1, targetFps);

            IntPtr hDesktopWnd = GetDesktopWindow();
            IntPtr hDesktopDC = GetWindowDC(hDesktopWnd);
            IntPtr hCaptureDC = CreateCompatibleDC(hDesktopDC);
            IntPtr hCaptureBmp = CreateCompatibleBitmap(hDesktopDC, outWidth, outHeight);
            IntPtr hOldBmp = SelectObject(hCaptureDC, hCaptureBmp);
            SetStretchBltMode(hCaptureDC, COLORONCOLOR);

            while (true)
            {
                var frameStart = sw.ElapsedMilliseconds;

                StretchBlt(hCaptureDC, 0, 0, outWidth, outHeight, hDesktopDC, 0, 0, width, height, SRCCOPY);

                using (Bitmap srcBmp = Image.FromHbitmap(hCaptureBmp))
                {
                    ms.Position = 0;
                    ms.SetLength(0);
                    srcBmp.Save(ms, jpgEncoder, encParams);
                }

                int length = (int)ms.Position;
                header[0] = (byte)'F';
                header[1] = (byte)'R';
                header[2] = (byte)'M';
                header[3] = (byte)'1';
                header[4] = (byte)((length >> 24) & 0xFF);
                header[5] = (byte)((length >> 16) & 0xFF);
                header[6] = (byte)((length >> 8) & 0xFF);
                header[7] = (byte)(length & 0xFF);

                try
                {
                    stdout.Write(header, 0, 8);
                    stdout.Write(ms.GetBuffer(), 0, length);
                    stdout.Flush();
                }
                catch
                {
                    break;
                }

                var elapsed = sw.ElapsedMilliseconds - frameStart;
                var sleep = frameIntervalMs - elapsed;
                if (sleep > 0) Thread.Sleep((int)sleep);
            }

            SelectObject(hCaptureDC, hOldBmp);
            DeleteObject(hCaptureBmp);
            DeleteDC(hCaptureDC);
            ReleaseDC(hDesktopWnd, hDesktopDC);
        }

        static void RunBenchmark(int width, int height, int quality, float scale)
        {
            Console.WriteLine($"Running hardware StretchBlt benchmark on {width}x{height} -> {(int)(width * scale)}x{(int)(height * scale)} (Quality={quality}%)...");
            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
            EncoderParameters encParams = new EncoderParameters(1);
            encParams.Param[0] = new EncoderParameter(Encoder.Quality, (long)quality);

            int outWidth = (int)(width * scale);
            int outHeight = (int)(height * scale);

            IntPtr hDesktopWnd = GetDesktopWindow();
            IntPtr hDesktopDC = GetWindowDC(hDesktopWnd);
            IntPtr hCaptureDC = CreateCompatibleDC(hDesktopDC);
            IntPtr hCaptureBmp = CreateCompatibleBitmap(hDesktopDC, outWidth, outHeight);
            IntPtr hOldBmp = SelectObject(hCaptureDC, hCaptureBmp);
            SetStretchBltMode(hCaptureDC, COLORONCOLOR);

            using var ms = new MemoryStream();
            var sw = Stopwatch.StartNew();
            int frames = 60;

            for (int i = 0; i < frames; i++)
            {
                StretchBlt(hCaptureDC, 0, 0, outWidth, outHeight, hDesktopDC, 0, 0, width, height, SRCCOPY);
                using (Bitmap srcBmp = Image.FromHbitmap(hCaptureBmp))
                {
                    ms.Position = 0;
                    ms.SetLength(0);
                    srcBmp.Save(ms, jpgEncoder, encParams);
                }
            }

            sw.Stop();
            double avgMs = sw.Elapsed.TotalMilliseconds / frames;
            double fps = 1000.0 / avgMs;
            Console.WriteLine($"Direct StretchBlt Benchmark: {frames} frames in {sw.ElapsedMilliseconds}ms! Avg frame time: {avgMs:F2}ms ({fps:F1} FPS). Compressed JPEG frame size: {ms.Length / 1024} KB.");

            SelectObject(hCaptureDC, hOldBmp);
            DeleteObject(hCaptureBmp);
            DeleteDC(hCaptureDC);
            ReleaseDC(hDesktopWnd, hDesktopDC);
        }

        static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            ImageCodecInfo[] codecs = ImageCodecInfo.GetImageDecoders();
            foreach (ImageCodecInfo codec in codecs)
            {
                if (codec.FormatID == format.Guid) return codec;
            }
            return null;
        }
    }
}
